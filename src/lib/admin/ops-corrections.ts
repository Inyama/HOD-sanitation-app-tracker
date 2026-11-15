import "server-only";
import { DateTime } from "luxon";
import type { Repository } from "@/lib/repo/interfaces";
import type { AttendanceRecord, AttendanceStatus, Meeting, User } from "@/lib/repo/types";
import { MEETING_ZONE } from "@/lib/time/zone";
import {
  CORRECTION_MESSAGES,
  correctionPatch,
  newRecordFor,
  recordSnapshot,
  STATUS_LABELS,
  type CorrectionInput,
} from "./corrections";
import { audit, fail, materializeMeeting, notify, type OpsContext } from "./ops-common";

/** Corrections and disputes (spec 7.4 item 15): change a record only with a reason; before and after. */

const utc = (iso: string) => DateTime.fromISO(iso, { zone: "utc" });

export async function loadCorrections(repo: Repository, now: DateTime) {
  const [records, users, meetings, disputes, history] = await Promise.all([
    repo.records.list(),
    repo.users.list(),
    repo.meetings.list(),
    repo.disputes.list(),
    repo.audit.list({
      where: { action: "ATTENDANCE_CORRECTED" },
      orderBy: { field: "createdAt", dir: "desc" },
      limit: 30,
    }),
  ]);
  const user = new Map(users.map((u) => [u.id, u]));
  const meeting = new Map(meetings.map((m) => [m.id, m]));
  const recent = now.minus({ days: 90 });
  const recordRow = (r: AttendanceRecord) => {
    const m = meeting.get(r.meetingId);
    return {
      id: r.id,
      person: { id: r.userId, name: user.get(r.userId)?.name ?? "Unknown" },
      meeting: meetingInfo(m, r.meetingId),
      status: r.status,
      checkedInAt: r.checkedInAt,
      method: r.method,
      flagged: r.flagged,
      flagReason: r.flagReason,
      distanceM: r.distanceM === null ? null : Math.round(r.distanceM),
      accuracyM: r.accuracyM === null ? null : Math.round(r.accuracyM),
      deviceId: r.deviceId,
      recordedBy: r.recordedById ? (user.get(r.recordedById)?.name ?? "Admin") : null,
      note: r.note,
    };
  };
  const flagged = records
    .filter((r) => r.flagged)
    .sort((a, b) => (meeting.get(b.meetingId)?.startsAt ?? "").localeCompare(meeting.get(a.meetingId)?.startsAt ?? ""));
  // Manual check-ins by marshals (with a check-in time); closing absentees are not listed.
  const manual = records
    .filter(
      (r) =>
        r.method === "MANUAL" &&
        !r.flagged &&
        r.checkedInAt &&
        utc(meeting.get(r.meetingId)?.startsAt ?? r.checkedInAt) >= recent,
    )
    .sort((a, b) => (b.checkedInAt ?? "").localeCompare(a.checkedInAt ?? ""))
    .slice(0, 40);
  const disputeRows = disputes
    .filter((d) => d.status === "OPEN" || utc(d.createdAt) >= recent)
    .sort((a, b) => (a.status === b.status ? b.createdAt.localeCompare(a.createdAt) : a.status === "OPEN" ? -1 : 1))
    .map((d) => {
      const rec = records.find((r) => r.meetingId === d.meetingId && r.userId === d.userId);
      return {
        id: d.id,
        status: d.status,
        claimed: d.claimed,
        message: d.message,
        createdAt: d.createdAt,
        resolutionNote: d.resolutionNote,
        resolvedBy: d.resolvedById ? (user.get(d.resolvedById)?.name ?? "Admin") : null,
        person: { id: d.userId, name: user.get(d.userId)?.name ?? "Unknown" },
        meeting: meetingInfo(meeting.get(d.meetingId), d.meetingId),
        record: rec ? { id: rec.id, status: rec.status, checkedInAt: rec.checkedInAt, method: rec.method } : null,
      };
    });
  return {
    flagged: flagged.map(recordRow),
    manual: manual.map(recordRow),
    disputes: disputeRows,
    history: history.map((h) => {
      const after = h.after as (Snapshot & { reason?: string; person?: string; meeting?: string }) | null;
      // Older entries (for example the seed) only kept the statuses; fill in who and which meeting.
      const rec = h.entityId ? records.find((r) => r.id === h.entityId) : undefined;
      const m = rec ? meeting.get(rec.meetingId) : undefined;
      return {
        id: h.id,
        at: h.createdAt,
        by: h.actorId ? (user.get(h.actorId)?.name ?? "Admin") : "System",
        before: h.before as Snapshot | null,
        after: after
          ? {
              ...after,
              person: after.person ?? (rec ? user.get(rec.userId)?.name : undefined),
              meeting:
                after.meeting ??
                (m ? `${m.title}, ${utc(m.startsAt).setZone(MEETING_ZONE).toFormat("d LLL yyyy")}` : undefined),
            }
          : null,
      };
    }),
  };
}

type Snapshot = { status: AttendanceStatus; checkedInAt: string | null; method: string; flagged: boolean };

function meetingInfo(m: Meeting | undefined, id: string) {
  return {
    id,
    title: m?.title ?? "Meeting",
    startsAt: m?.startsAt ?? "",
    graceMinutes: m?.graceMinutes ?? 0,
  };
}

export type CorrectionsData = Awaited<ReturnType<typeof loadCorrections>>;

async function tellPerson(
  repo: Repository,
  ctx: OpsContext,
  person: User,
  meeting: Meeting,
  status: AttendanceStatus,
  reason: string,
) {
  const when = utc(meeting.startsAt).setZone(MEETING_ZONE).toFormat("ccc d LLL");
  await notify(
    repo,
    ctx,
    person.id,
    "ATTENDANCE_CORRECTED",
    `Attendance updated: ${meeting.title}, ${when}`,
    `An admin changed your record to ${STATUS_LABELS[status]}. Reason: ${reason}`,
  );
}

async function applyCorrection(
  repo: Repository,
  ctx: OpsContext,
  meeting: Meeting,
  person: User,
  existing: AttendanceRecord | null,
  input: CorrectionInput,
  source: string,
) {
  const current = existing ?? { ...newRecordFor(meeting.id, person.id), id: "" };
  const res = correctionPatch(current, meeting, input, ctx.admin.id, ctx.now);
  if (!res.ok) return fail(res.error, CORRECTION_MESSAGES[res.error], 422);
  const saved = existing
    ? await repo.records.update(existing.id, res.patch)
    : await repo.records.create({ ...newRecordFor(meeting.id, person.id), ...res.patch });
  await audit(
    repo,
    ctx,
    "ATTENDANCE_CORRECTED",
    "AttendanceRecord",
    saved.id,
    existing ? recordSnapshot(existing) : null,
    {
      ...recordSnapshot(saved),
      reason: input.reason,
      source,
      person: person.name,
      meeting: `${meeting.title}, ${utc(meeting.startsAt).setZone(MEETING_ZONE).toFormat("d LLL yyyy")}`,
    },
  );
  await tellPerson(repo, ctx, person, meeting, saved.status, input.reason);
  return { ok: true as const, record: recordSnapshot(saved) };
}

export async function correctRecord(repo: Repository, ctx: OpsContext, recordId: string, input: CorrectionInput) {
  const record = await repo.records.get(recordId);
  if (!record) return fail("NOT_FOUND", "Record not found.", 404);
  const [meeting, person] = await Promise.all([repo.meetings.get(record.meetingId), repo.users.get(record.userId)]);
  if (!meeting || !person) return fail("NOT_FOUND", "The meeting or person no longer exists.", 404);
  return applyCorrection(repo, ctx, meeting, person, record, input, record.flagged ? "flagged" : "record");
}

/** Clear a flag without changing the record ("looks fine"). */
export async function reviewFlag(repo: Repository, ctx: OpsContext, recordId: string, note: string | undefined) {
  const record = await repo.records.get(recordId);
  if (!record) return fail("NOT_FOUND", "Record not found.", 404);
  if (!record.flagged) return fail("NOT_FLAGGED", "This check-in is not flagged.", 409);
  await repo.records.update(record.id, {
    flagged: false,
    note: [record.note, `Reviewed by an admin${note ? `: ${note}` : ""}`].filter(Boolean).join(" · "),
  });
  await audit(
    repo,
    ctx,
    "FLAG_REVIEWED",
    "AttendanceRecord",
    record.id,
    { flagged: true, flagReason: record.flagReason },
    { flagged: false, note: note ?? null },
  );
  return { ok: true as const };
}

export async function decideDispute(
  repo: Repository,
  ctx: OpsContext,
  disputeId: string,
  input:
    | { accept: true; status: AttendanceStatus; arrivedAt?: string | null; note: string }
    | { accept: false; note: string },
) {
  const dispute = await repo.disputes.get(disputeId);
  if (!dispute) return fail("NOT_FOUND", "Dispute not found.", 404);
  if (dispute.status !== "OPEN") return fail("ALREADY_DECIDED", "This dispute was already resolved.", 409);
  const [meeting, person] = await Promise.all([
    materializeMeeting(repo, dispute.meetingId),
    repo.users.get(dispute.userId),
  ]);
  if (!meeting || !person) return fail("NOT_FOUND", "The meeting or person no longer exists.", 404);
  if (input.accept) {
    const record = await repo.records.findFirst({ meetingId: meeting.id, userId: person.id });
    const res = await applyCorrection(
      repo,
      ctx,
      meeting,
      person,
      record,
      { status: input.status, arrivedAt: input.arrivedAt, reason: input.note },
      "dispute",
    );
    if (!res.ok) return res;
  } else {
    const when = utc(meeting.startsAt).setZone(MEETING_ZONE).toFormat("ccc d LLL");
    await notify(
      repo,
      ctx,
      person.id,
      "DISPUTE_DECLINED",
      `Your attendance query: ${meeting.title}, ${when}`,
      `An admin looked into it and kept the record as it is. Note: ${input.note}`,
    );
  }
  await repo.disputes.update(dispute.id, {
    status: "RESOLVED",
    resolvedById: ctx.admin.id,
    resolutionNote: input.note,
    resolvedAt: ctx.now.toISO()!,
  });
  await audit(
    repo,
    ctx,
    "DISPUTE_RESOLVED",
    "AttendanceDispute",
    dispute.id,
    { status: "OPEN" },
    { status: "RESOLVED", accepted: input.accept, note: input.note },
  );
  return { ok: true as const };
}

/** A member says one of their records is wrong (held meetings in the last 30 days). */
export async function createDispute(
  repo: Repository,
  user: User,
  now: DateTime,
  input: { meetingId: string; claimed: AttendanceStatus; message: string },
) {
  const meeting = await materializeMeeting(repo, input.meetingId);
  if (!meeting) return fail("NOT_FOUND", "Meeting not found.", 404);
  const start = utc(meeting.startsAt);
  if (start > now) return fail("NOT_HELD", "You can query a record once the meeting has started.", 422);
  if (start < now.minus({ days: 30 }))
    return fail("TOO_OLD", "Records can be queried for 30 days after the meeting.", 422);
  if (meeting.status === "CANCELLED")
    return fail("CANCELLED", "This meeting was cancelled, so it does not count.", 422);
  const open = await repo.disputes.findFirst({ userId: user.id, meetingId: meeting.id, status: "OPEN" });
  if (open) return fail("DUPLICATE", "You already have an open query for this meeting.", 409);
  const record = await repo.records.findFirst({ userId: user.id, meetingId: meeting.id });
  if (record?.status === input.claimed)
    return fail("SAME", `Your record already says ${STATUS_LABELS[input.claimed]}.`, 422);
  const created = await repo.disputes.create({
    userId: user.id,
    meetingId: meeting.id,
    claimed: input.claimed,
    message: input.message,
    status: "OPEN",
    resolvedById: null,
    resolutionNote: null,
    createdAt: now.toISO()!,
    resolvedAt: null,
  });
  return { ok: true as const, id: created.id };
}
