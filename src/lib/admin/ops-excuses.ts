import "server-only";
import { DateTime } from "luxon";
import type { Repository } from "@/lib/repo/interfaces";
import type { ExcuseRequest } from "@/lib/repo/types";
import { statusAfterDecision } from "@/lib/attendance/excuses";
import { authStore } from "@/lib/auth/store";
import { appUrl, sendBrandedEmail } from "@/lib/notifications/senders";
import { firstName } from "@/lib/notifications/templates";
import { MEETING_ZONE } from "@/lib/time/zone";
import { audit, fail, materializeMeeting, notify, type OpsContext } from "./ops-common";

/** Excuse requests (spec 6.6, 7.4 item 13): queue with proof preview, approve or decline with a note. */

const utc = (iso: string) => DateTime.fromISO(iso, { zone: "utc" });
const STATUS_WORD = { ON_TIME: "On time", LATE: "Late", ABSENT: "Absent", EXCUSED: "Excused" } as const;

/** What kind of proof a stored URL points to, so the queue can show a preview. */
function proofKind(url: string | null): "image" | "pdf" | null {
  if (!url) return null;
  const id = url.match(/\/api\/v1\/files\/([\w-]+)$/)?.[1];
  const stored = id ? authStore().files.get(id) : undefined;
  const type = stored?.type ?? (url.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/");
  return type === "application/pdf" ? "pdf" : type.startsWith("image/") ? "image" : null;
}

export async function loadExcuseQueue(repo: Repository, now: DateTime) {
  const [excuses, users, meetings, records] = await Promise.all([
    repo.excuses.list(),
    repo.users.list(),
    repo.meetings.list(),
    repo.records.list(),
  ]);
  const user = new Map(users.map((u) => [u.id, u]));
  const meeting = new Map(meetings.map((m) => [m.id, m]));
  const yearStart = now.setZone(MEETING_ZONE).startOf("year");
  const row = (e: ExcuseRequest) => {
    const m = meeting.get(e.meetingId);
    const u = user.get(e.userId);
    const rec = records.find((r) => r.meetingId === e.meetingId && r.userId === e.userId);
    return {
      id: e.id,
      status: e.status,
      reason: e.reason,
      proofUrl: e.proofUrl,
      proofKind: proofKind(e.proofUrl),
      createdAt: e.createdAt,
      reviewNote: e.reviewNote,
      reviewer: e.reviewedById ? (user.get(e.reviewedById)?.name ?? "Admin") : null,
      person: { id: e.userId, name: u?.name ?? "Unknown", email: u?.email ?? "" },
      meeting: {
        id: e.meetingId,
        title: m?.title ?? "Meeting",
        startsAt: m?.startsAt ?? e.createdAt,
        held: m ? utc(m.startsAt) <= now : true,
      },
      recordStatus: rec?.status ?? null,
      excusesThisYear: excuses.filter(
        (x) => x.userId === e.userId && x.status === "APPROVED" && utc(x.createdAt) >= yearStart,
      ).length,
    };
  };
  const pending = excuses.filter((e) => e.status === "PENDING").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const decided = excuses
    .filter((e) => e.status !== "PENDING" && utc(e.createdAt) >= now.minus({ days: 90 }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { pending: pending.map(row), decided: decided.map(row) };
}

export type ExcuseRow = Awaited<ReturnType<typeof loadExcuseQueue>>["pending"][number];

export async function decideExcuse(
  repo: Repository,
  ctx: OpsContext,
  id: string,
  decision: "APPROVED" | "DECLINED",
  note: string | undefined,
) {
  const excuse = await repo.excuses.get(id);
  if (!excuse) return fail("NOT_FOUND", "Excuse request not found.", 404);
  if (excuse.status !== "PENDING") return fail("ALREADY_DECIDED", "This request was already decided.", 409);
  const [person, meeting] = await Promise.all([
    repo.users.get(excuse.userId),
    materializeMeeting(repo, excuse.meetingId),
  ]);
  if (!person || !meeting) return fail("NOT_FOUND", "The person or meeting no longer exists.", 404);
  const record = await repo.records.findFirst({ meetingId: meeting.id, userId: person.id });
  const before = record?.status ?? null;
  const after = statusAfterDecision(before, decision);
  const held = utc(meeting.startsAt) <= ctx.now;

  await repo.transaction(async (tx) => {
    await tx.excuses.update(excuse.id, {
      status: decision,
      reviewedById: ctx.admin.id,
      reviewNote: note?.trim() || null,
    });
    if (record && after && after !== before) {
      await tx.records.update(record.id, {
        status: after,
        checkedInAt: null,
        recordedById: ctx.admin.id,
        note: "Excuse approved",
      });
    } else if (!record && after === "EXCUSED" && held && meeting.status === "CLOSED") {
      // A closed meeting with no record (for example before absentees were written).
      await tx.records.create({
        meetingId: meeting.id,
        userId: person.id,
        status: "EXCUSED",
        checkedInAt: null,
        method: "MANUAL",
        lat: null,
        lng: null,
        accuracyM: null,
        distanceM: null,
        deviceId: null,
        flagged: false,
        flagReason: null,
        sourceUploadId: null,
        recordedById: ctx.admin.id,
        note: "Excuse approved",
      });
    }
  });

  const when = utc(meeting.startsAt).setZone(MEETING_ZONE).toFormat("ccc d LLL");
  const title =
    decision === "APPROVED"
      ? `Excuse approved: ${meeting.title}, ${when}`
      : `Excuse declined: ${meeting.title}, ${when}`;
  const body =
    decision === "APPROVED"
      ? `Your excuse for the ${meeting.title} on ${when} was approved, so it does not count against your attendance.${note ? ` Note: ${note}` : ""}`
      : `Your excuse for the ${meeting.title} on ${when} was not approved. Note: ${note}`;
  await notify(repo, ctx, person.id, "EXCUSE_DECISION", title, body, `${person.id}:${excuse.id}:EXCUSE_DECISION`);
  if (person.status === "ACTIVE")
    await sendBrandedEmail(person.email, "EXCUSE_DECISION", {
      subject: title,
      preheader: body.slice(0, 90),
      heading: decision === "APPROVED" ? "Your excuse was approved" : "About your excuse request",
      paragraphs: [`Hello ${firstName(person.name)},`, body],
      button: { label: "See my excuse requests", url: `${appUrl()}/member/excuses` },
    });
  await audit(
    repo,
    ctx,
    decision === "APPROVED" ? "EXCUSE_APPROVED" : "EXCUSE_DECLINED",
    "ExcuseRequest",
    excuse.id,
    { status: "PENDING", record: before ? STATUS_WORD[before] : null },
    { status: decision, record: after ? STATUS_WORD[after] : null, note: note ?? null },
  );
  return { ok: true as const, recordStatus: after };
}
