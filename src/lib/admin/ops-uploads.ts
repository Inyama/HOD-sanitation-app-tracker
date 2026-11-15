import "server-only";
import { DateTime } from "luxon";
import type { Repository } from "@/lib/repo/interfaces";
import type { AttendanceUpload, User } from "@/lib/repo/types";
import { authStore } from "@/lib/auth/store";
import { randomToken } from "@/lib/auth/tokens";
import { checkFile, isParseError, parseCsv, parseXlsx, type ParsedSheet } from "@/lib/matching/parse";
import { detectColumns, type ColumnMap } from "@/lib/matching/columns";
import { matchSheet } from "@/lib/matching/matchSheet";
import { buildUploadRecords, planReplacement, type Resolution } from "@/lib/matching/upload";
import { grantAutoHours } from "@/lib/volunteer/auto-hours";
import { lowAttendanceAfter } from "@/lib/notifications/runner";
import { meetingsBetween } from "@/lib/time/schedule";
import {
  decodeResolution,
  encodeResolution,
  expectedPeople,
  ignoredCount,
  matchesFromRows,
  summarizeDrafts,
  undecided,
} from "./uploads";
import { audit, fail, materializeMeeting, type OpsContext } from "./ops-common";
import Papa from "papaparse";
import * as XLSX from "xlsx";

/** Attendance upload wizard (spec 6.4, 7.4 item 6): inspect, preview, resolve, confirm, roll back. */

function decode(data: string): Buffer {
  return Buffer.from(data, "base64");
}

function parse(name: string, buf: Buffer, mapping?: ColumnMap) {
  return name.toLowerCase().endsWith(".xlsx")
    ? parseXlsx(new Uint8Array(buf), mapping)
    : parseCsv(buf.toString("utf8"), mapping);
}

/** First rows of the file as text, for the column mapping step. */
function headerAndSample(name: string, buf: Buffer): { headers: string[]; sample: string[][]; rows: number } {
  let table: unknown[][];
  if (name.toLowerCase().endsWith(".xlsx")) {
    const wb = XLSX.read(buf, { type: "buffer" });
    table = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" }) as unknown[][];
  } else {
    table = Papa.parse<string[]>(buf.toString("utf8").replace(/^﻿/, ""), { skipEmptyLines: "greedy" }).data;
  }
  const nonEmpty = table.filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
  return {
    headers: (nonEmpty[0] ?? []).map((c) => String(c ?? "").trim()),
    sample: nonEmpty.slice(1, 6).map((r) => r.map((c) => String(c ?? "").trim())),
    rows: Math.max(0, nonEmpty.length - 1),
  };
}

/** Recent held meetings (and today's) an admin can upload a sheet for. */
export async function uploadableMeetings(repo: Repository, now: DateTime) {
  const stored = await repo.meetings.list();
  return meetingsBetween(stored, now.minus({ weeks: 8 }), now.plus({ days: 1 }))
    .filter((m) => m.status !== "CANCELLED" && DateTime.fromISO(m.startsAt) <= now.plus({ hours: 1 }))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}

export async function inspectUpload(name: string, sizeBytes: number, data: string) {
  const bad = checkFile(name, sizeBytes);
  if (bad) return fail(bad.code, bad.message, 415);
  const buf = decode(data);
  if (buf.length > 5 * 1024 * 1024) return fail("TOO_LARGE", "Files must be 5 MB or smaller.", 413);
  const head = headerAndSample(name, buf);
  if (head.rows === 0) return fail("EMPTY", "The file has no rows.", 422);
  const detected = detectColumns(head.headers);
  return { ok: true as const, ...head, columns: detected.map };
}

export async function createPreview(
  repo: Repository,
  ctx: OpsContext,
  input: { meetingId: string; name: string; size: number; data: string; mapping?: ColumnMap },
) {
  const bad = checkFile(input.name, input.size);
  if (bad) return fail(bad.code, bad.message, 415);
  const meeting = await materializeMeeting(repo, input.meetingId);
  if (!meeting) return fail("NOT_FOUND", "Choose a meeting from the list.", 404);
  if (meeting.status === "CANCELLED") return fail("CANCELLED", "That meeting was cancelled.", 409);
  if (DateTime.fromISO(meeting.startsAt) > ctx.now.plus({ hours: 1 }))
    return fail("NOT_HELD", "Upload the sheet after the meeting has started.", 409);
  const buf = decode(input.data);
  const parsed = parse(input.name, buf, input.mapping);
  if (isParseError(parsed)) return fail(parsed.code, parsed.message, 422);
  const sheet = parsed as ParsedSheet;
  const users = await repo.users.list();
  const result = matchSheet(
    sheet.rows,
    users.map((u) => ({ id: u.id, name: u.name, email: u.email, secondaryEmail: u.secondaryEmail, status: u.status })),
  );

  // Keep the original file (spec: every upload stores the original file).
  const fileId = randomToken(12);
  authStore().files.set(fileId, {
    id: fileId,
    ownerId: ctx.admin.id,
    name: input.name,
    type: input.name.toLowerCase().endsWith(".xlsx")
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "text/csv",
    data: buf,
    createdAt: ctx.now.toISO()!,
  });

  // An older unconfirmed preview for the same meeting is replaced by this one.
  for (const old of await repo.uploads.list({ where: { meetingId: meeting.id, status: "PREVIEW" } })) {
    await repo.uploadRows.deleteMany({ uploadId: old.id });
    await repo.uploads.delete(old.id);
  }
  const upload = await repo.uploads.create({
    meetingId: meeting.id,
    fileUrl: `/api/v1/files/${fileId}`,
    originalName: input.name,
    uploadedById: ctx.admin.id,
    status: "PREVIEW",
    rowsTotal: result.summary.total,
    rowsMatched: result.summary.matched,
    rowsException: result.summary.exceptions,
    uploadedAt: ctx.now.toISO()!,
    rolledBackAt: null,
  });
  await repo.uploadRows.createMany(
    result.rows.map((m) => ({
      id: `${upload.id}-row-${String(m.index + 1).padStart(4, "0")}`,
      uploadId: upload.id,
      rawName: m.row.name,
      rawEmail: m.row.email,
      rawTime: m.row.time ?? null,
      matchedUserId: m.matchedUserId,
      matchType: m.matchType,
      similarity: m.similarity,
      resolution: null,
    })),
  );
  await audit(repo, ctx, "UPLOAD_PREVIEWED", "AttendanceUpload", upload.id, null, {
    meetingId: meeting.id,
    file: input.name,
    ...result.summary,
    skippedBlank: sheet.skippedBlank,
  });
  return { ok: true as const, uploadId: upload.id, summary: result.summary, skippedBlank: sheet.skippedBlank };
}

async function loadRows(repo: Repository, uploadId: string) {
  return (await repo.uploadRows.list({ where: { uploadId } })).sort((a, b) => a.id.localeCompare(b.id));
}

export async function previewDetails(repo: Repository, uploadId: string) {
  const upload = await repo.uploads.get(uploadId);
  if (!upload) return null;
  const [rows, users, meeting, records, excuses] = await Promise.all([
    loadRows(repo, uploadId),
    repo.users.list(),
    repo.meetings.get(upload.meetingId),
    repo.records.list({ where: { meetingId: upload.meetingId } }),
    repo.excuses.list({ where: { meetingId: upload.meetingId, status: "APPROVED" } }),
  ]);
  if (!meeting) return null;
  const byId = new Map(users.map((u) => [u.id, u]));
  const matches = matchesFromRows(rows, (id) => byId.get(id)?.status);
  const resolutions = new Map<number, Resolution>();
  rows.forEach((r, i) => {
    const d = decodeResolution(r.resolution);
    if (d) resolutions.set(i, d);
  });
  const drafts = buildUploadRecords({
    meetingStartIso: meeting.startsAt,
    graceMinutes: meeting.graceMinutes,
    matches,
    resolutions,
    expected: expectedPeople(meeting, users),
    approvedExcuseUserIds: new Set(excuses.map((e) => e.userId)),
  });
  const plan = planReplacement(records, drafts);
  const otherSheet = records.filter((r) => r.method === "SHEET" && r.sourceUploadId !== uploadId);
  return {
    upload,
    meeting,
    rows: rows.map((r, i) => ({
      id: r.id,
      index: i,
      name: r.rawName,
      email: r.rawEmail,
      time: r.rawTime,
      matchType: r.matchType,
      similarity: r.similarity,
      matchedUserId: r.matchedUserId,
      matchedName: r.matchedUserId ? (byId.get(r.matchedUserId)?.name ?? null) : null,
      warning: matches[i].warning,
      duplicateOf: matches[i].duplicateOf,
      resolution: resolutions.get(i) ?? null,
    })),
    undecided: undecided(matches, resolutions).length,
    plan: summarizeDrafts(plan.insert, ignoredCount(matches, resolutions)),
    keptFromPhone: drafts.length - plan.insert.length,
    replaces: otherSheet.length,
    people: users
      .filter((u) => u.status !== "REMOVED")
      .map((u: User) => ({ id: u.id, name: u.name, email: u.email, status: u.status }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export type UploadPreview = NonNullable<Awaited<ReturnType<typeof previewDetails>>>;
export type UploadHistoryRow = Awaited<ReturnType<typeof uploadHistory>>[number];

export async function resolveRow(
  repo: Repository,
  ctx: OpsContext,
  uploadId: string,
  rowId: string,
  resolution: Resolution | null,
) {
  const upload = await repo.uploads.get(uploadId);
  if (!upload || upload.status !== "PREVIEW") return fail("NOT_PREVIEW", "This upload is no longer in preview.", 409);
  const row = await repo.uploadRows.get(rowId);
  if (!row || row.uploadId !== uploadId) return fail("NOT_FOUND", "Row not found.", 404);
  if (row.matchType === "DUPLICATE")
    return fail("DUPLICATE", "Duplicate rows are kept once and cannot be changed.", 409);
  if (resolution?.kind === "ASSIGN") {
    const u = await repo.users.get(resolution.userId);
    if (!u || u.status === "REMOVED") return fail("NOT_FOUND", "Choose a person from the list.", 404);
  }
  await repo.uploadRows.update(rowId, { resolution: resolution ? encodeResolution(resolution) : null });
  return { ok: true as const };
}

export async function confirmUpload(repo: Repository, ctx: OpsContext, uploadId: string, replace: boolean) {
  const details = await previewDetails(repo, uploadId);
  if (!details) return fail("NOT_FOUND", "Upload not found.", 404);
  const { upload, meeting } = details;
  if (upload.status !== "PREVIEW") return fail("NOT_PREVIEW", "This upload was already confirmed or rolled back.", 409);
  if (details.undecided > 0)
    return fail(
      "NEEDS_DECISIONS",
      `Decide the ${details.undecided} suggested ${details.undecided === 1 ? "match" : "matches"} first.`,
      409,
    );
  if (details.replaces > 0 && !replace)
    return fail(
      "NEEDS_REPLACE_CONFIRM",
      `This meeting already has ${details.replaces} records from an earlier sheet. Confirm that this sheet replaces them.`,
      409,
    );

  const [rows, users, records, excuses] = await Promise.all([
    loadRows(repo, uploadId),
    repo.users.list(),
    repo.records.list({ where: { meetingId: meeting.id } }),
    repo.excuses.list({ where: { meetingId: meeting.id, status: "APPROVED" } }),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));
  const matches = matchesFromRows(rows, (id) => byId.get(id)?.status);
  const resolutions = new Map<number, Resolution>();
  rows.forEach((r, i) => {
    const d = decodeResolution(r.resolution);
    if (d) resolutions.set(i, d);
  });
  const drafts = buildUploadRecords({
    meetingStartIso: meeting.startsAt,
    graceMinutes: meeting.graceMinutes,
    matches,
    resolutions,
    expected: expectedPeople(meeting, users),
    approvedExcuseUserIds: new Set(excuses.map((e) => e.userId)),
  });
  const plan = planReplacement(records, drafts);

  const replacedUploads = [
    ...new Set(records.filter((r) => r.method === "SHEET" && r.sourceUploadId).map((r) => r.sourceUploadId!)),
  ];
  const replacedRecords = records.filter((r) => plan.deleteIds.includes(r.id));
  await repo.transaction(async (tx) => {
    for (const id of plan.deleteIds) await tx.records.delete(id);
    await tx.records.createMany(
      plan.insert.map((d) => ({
        meetingId: meeting.id,
        userId: d.userId,
        status: d.status,
        checkedInAt: d.checkedInAt,
        method: "SHEET" as const,
        lat: null,
        lng: null,
        accuracyM: null,
        distanceM: null,
        deviceId: null,
        flagged: false,
        flagReason: null,
        sourceUploadId: uploadId,
        recordedById: ctx.admin.id,
        note: null,
      })),
    );
    for (const id of replacedUploads)
      if (id !== uploadId) await tx.uploads.update(id, { status: "ROLLED_BACK", rolledBackAt: ctx.now.toISO()! });
    await tx.uploads.update(uploadId, {
      status: "CONFIRMED",
      replaced: replacedRecords.length
        ? { records: replacedRecords, uploadIds: replacedUploads.filter((x) => x !== uploadId) }
        : null,
    });
    if (meeting.status === "SCHEDULED" || meeting.status === "OPEN")
      await tx.meetings.update(meeting.id, { status: "CLOSED" });
  });
  for (const d of plan.insert)
    if (d.status === "ON_TIME" || d.status === "LATE") {
      const u = byId.get(d.userId);
      if (u) await grantAutoHours(repo, u, meeting, ctx.now);
    }
  const s = summarizeDrafts(plan.insert, ignoredCount(matches, resolutions));
  await audit(repo, ctx, "UPLOAD_CONFIRMED", "AttendanceUpload", uploadId, null, {
    meetingId: meeting.id,
    ...s,
    replacedUploads: replacedUploads.filter((x) => x !== uploadId),
  });
  await lowAttendanceAfter(repo, meeting.id, ctx.now);
  return { ok: true as const, ...s };
}

export async function rollbackUpload(repo: Repository, ctx: OpsContext, uploadId: string) {
  const upload = await repo.uploads.get(uploadId);
  if (!upload) return fail("NOT_FOUND", "Upload not found.", 404);
  if (upload.status === "PREVIEW") {
    await repo.uploadRows.deleteMany({ uploadId });
    await repo.uploads.delete(uploadId);
    await audit(repo, ctx, "UPLOAD_DISCARDED", "AttendanceUpload", uploadId, { status: "PREVIEW" }, null);
    return { ok: true as const, removed: 0, discarded: true };
  }
  if (upload.status === "ROLLED_BACK") return fail("ALREADY_ROLLED_BACK", "This upload was already rolled back.", 409);
  const mine = (await repo.records.list({ where: { meetingId: upload.meetingId } })).filter(
    (r) => r.sourceUploadId === uploadId && r.method === "SHEET",
  );
  // Put back what this upload replaced (the earlier sheet), unless a record now exists for that person.
  const restore = upload.replaced?.records ?? [];
  await repo.transaction(async (tx) => {
    for (const r of mine) await tx.records.delete(r.id);
    const left = new Set((await tx.records.list({ where: { meetingId: upload.meetingId } })).map((r) => r.userId));
    for (const r of restore) if (!left.has(r.userId)) await tx.records.create(r);
    for (const id of upload.replaced?.uploadIds ?? [])
      await tx.uploads.update(id, { status: "CONFIRMED", rolledBackAt: null });
    await tx.uploads.update(uploadId, { status: "ROLLED_BACK", rolledBackAt: ctx.now.toISO()! });
  });
  await audit(
    repo,
    ctx,
    "UPLOAD_ROLLED_BACK",
    "AttendanceUpload",
    uploadId,
    { status: "CONFIRMED", records: mine.length },
    { status: "ROLLED_BACK", restoredRecords: restore.length, restoredUploads: upload.replaced?.uploadIds ?? [] },
  );
  return { ok: true as const, removed: mine.length, restored: restore.length, discarded: false };
}

export async function uploadHistory(repo: Repository) {
  const [uploads, users, meetings] = await Promise.all([repo.uploads.list(), repo.users.list(), repo.meetings.list()]);
  const name = new Map(users.map((u) => [u.id, u.name]));
  const meeting = new Map(meetings.map((m) => [m.id, m]));
  return uploads
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    .map((u: AttendanceUpload) => ({
      ...u,
      uploader: name.get(u.uploadedById) ?? "Admin",
      meetingTitle: meeting.get(u.meetingId)?.title ?? u.meetingId,
      meetingStart: meeting.get(u.meetingId)?.startsAt ?? null,
    }));
}

/** The stored original, or (for seeded uploads) a CSV rebuilt from the stored rows. */
export async function uploadOriginal(
  repo: Repository,
  uploadId: string,
): Promise<{ name: string; type: string; data: Buffer } | null> {
  const upload = await repo.uploads.get(uploadId);
  if (!upload) return null;
  const fileId = upload.fileUrl.match(/\/api\/v1\/files\/([\w-]+)$/)?.[1];
  const stored = fileId ? authStore().files.get(fileId) : undefined;
  if (stored) return { name: upload.originalName, type: stored.type, data: stored.data };
  const rows = await loadRows(repo, uploadId);
  const csv = Papa.unparse({
    fields: ["Full Name", "E-mail", "Check-in Time"],
    data: rows.map((r) => [r.rawName, r.rawEmail ?? "", r.rawTime ?? ""]),
  });
  return { name: upload.originalName.replace(/\.xlsx$/i, ".csv"), type: "text/csv", data: Buffer.from(`﻿${csv}`) };
}
