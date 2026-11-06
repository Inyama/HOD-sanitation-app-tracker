import "server-only";
import { DateTime } from "luxon";
import type { Repository } from "@/lib/repo/interfaces";
import type { AttendanceRecord, Meeting, User } from "@/lib/repo/types";
import { authStore } from "@/lib/auth/store";
import { authSecret } from "@/lib/auth/secret";
import { withRecurringMeetings } from "@/lib/time/schedule";
import { evaluateCheckIn, REJECTION_MESSAGES, type CheckInRejection, type CheckInStatus } from "./status";
import { describeFlags, spoofFlags } from "./geofence";
import { verifyQrCode } from "./qr";
import { attendanceViews } from "./aggregate";

/**
 * Geolocation check-in (spec 6.1, 6.2, 11). The browser sends only coordinates; time and status
 * come from the server clock. Suspicious check-ins are saved with flagged = true and the reasons,
 * never silently rejected.
 */

export type CheckInError =
  CheckInRejection | "NOT_FOUND" | "NOT_GEO" | "REMOTE_MEMBER" | "QR_REQUIRED" | "NOT_ELIGIBLE";

export interface CheckInSuccess {
  ok: true;
  status: CheckInStatus;
  checkedInAt: string;
  distanceM: number;
  accuracyM: number;
  flagged: boolean;
  percent: number | null;
  band: string;
  meetingTitle: string;
}

export interface CheckInFailure {
  ok: false;
  code: CheckInError;
  message: string;
  distanceM?: number;
}

const MESSAGES: Record<Exclude<CheckInError, CheckInRejection>, string> = {
  NOT_FOUND: "We could not find that meeting.",
  NOT_GEO: "This meeting is recorded from the attendee sheet, not by location check-in.",
  REMOTE_MEMBER:
    "You are marked as a Remote member, so you do not need to check in on Saturdays. A leader records you from the sheet.",
  QR_REQUIRED: "This meeting also needs the code shown on the marshal's screen. Ask a marshal for it.",
  NOT_ELIGIBLE: "This meeting is before you joined the unit.",
};

const ATTEMPT_WINDOW_MS = 10 * 60_000;

/** A stored meeting, or one generated from the weekly rules (saved on first use). */
export async function findMeeting(repo: Repository, id: string, now: DateTime): Promise<Meeting | null> {
  const stored = await repo.meetings.get(id);
  if (stored) return stored;
  const generated = withRecurringMeetings([], now, 6).find((m) => m.id === id);
  if (!generated) return null;
  return repo.meetings.create(generated);
}

export async function performCheckIn(
  repo: Repository,
  user: User,
  meetingId: string,
  body: { latitude: number; longitude: number; accuracy: number; deviceId: string; qrToken?: string },
  now: DateTime,
): Promise<CheckInSuccess | CheckInFailure> {
  const fail = (code: CheckInError, distanceM?: number): CheckInFailure => ({
    ok: false,
    code,
    message:
      code in REJECTION_MESSAGES
        ? REJECTION_MESSAGES[code as CheckInRejection]
        : MESSAGES[code as keyof typeof MESSAGES],
    distanceM: distanceM === undefined ? undefined : Math.round(distanceM),
  });

  const meeting = await findMeeting(repo, meetingId, now);
  if (!meeting) return fail("NOT_FOUND");
  if (meeting.method === "SHEET") return fail("NOT_GEO");
  if (user.isRemote && meeting.type === "SATURDAY") return fail("REMOTE_MEMBER");
  if (
    !user.approvedAt ||
    DateTime.fromISO(user.approvedAt) > DateTime.fromISO(meeting.startsAt).plus({ minutes: meeting.closeAfterMin })
  ) {
    return fail("NOT_ELIGIBLE");
  }

  // Count the attempt (anti-spoofing rule: more than 5 in 10 minutes).
  const store = authStore();
  const nowMs = now.toMillis();
  const attempts = (store.checkInAttempts.get(user.id) ?? []).filter(
    (t) => nowMs - t < ATTEMPT_WINDOW_MS && t <= nowMs,
  );
  store.checkInAttempts.set(user.id, [...attempts, nowMs]);

  const [settings, venues, existing] = await Promise.all([
    repo.settings.get(),
    repo.venues.list(),
    repo.records.findFirst({ meetingId: meeting.id, userId: user.id }),
  ]);
  const venue = venues.find((v) => v.id === (meeting.venueId ?? settings.venueId)) ?? venues[0];
  const result = evaluateCheckIn({
    nowUtc: now,
    meetingStartUtc: DateTime.fromISO(meeting.startsAt, { zone: "utc" }),
    meetingCancelled: meeting.status === "CANCELLED",
    alreadyCheckedIn: existing?.status === "ON_TIME" || existing?.status === "LATE",
    rules: {
      graceMinutes: meeting.graceMinutes ?? settings.graceMinutes,
      openBeforeMinutes: meeting.openBeforeMin,
      closeAfterMinutes: meeting.closeAfterMin,
    },
    reading: { lat: body.latitude, lng: body.longitude, accuracyM: body.accuracy },
    venue: { lat: venue.lat, lng: venue.lng, radiusM: venue.radiusM },
    maxAccuracyM: settings.maxAccuracyM,
  });
  if (!result.ok) return fail(result.reason, result.distanceM);

  if (meeting.requireQr && !(await verifyQrCode(meeting.id, body.qrToken, nowMs, authSecret())))
    return fail("QR_REQUIRED");

  // Anti-spoofing flags.
  const sameMeeting = await repo.records.list({ where: { meetingId: meeting.id } });
  const mine = (await repo.records.list({ where: { userId: user.id, method: "GEO" } }))
    .filter((r) => r.checkedInAt && r.lat !== null && r.lng !== null && r.meetingId !== meeting.id)
    .sort((a, b) => b.checkedInAt!.localeCompare(a.checkedInAt!));
  const prev = mine[0];
  const flags = spoofFlags(
    {
      userId: user.id,
      meetingId: meeting.id,
      deviceId: body.deviceId,
      lat: body.latitude,
      lng: body.longitude,
      accuracyM: body.accuracy,
      atMs: nowMs,
    },
    {
      sameMeetingCheckIns: sameMeeting
        .filter((r) => r.userId !== user.id)
        .map((r) => ({ userId: r.userId, deviceId: r.deviceId })),
      previousCheckIn: prev
        ? { lat: prev.lat!, lng: prev.lng!, atMs: DateTime.fromISO(prev.checkedInAt!).toMillis() }
        : null,
      attemptsLast10Min: attempts.length,
    },
  );

  const data: Omit<AttendanceRecord, "id"> = {
    meetingId: meeting.id,
    userId: user.id,
    status: result.status,
    checkedInAt: now.toISO()!,
    method: "GEO",
    lat: body.latitude,
    lng: body.longitude,
    accuracyM: Math.round(body.accuracy * 10) / 10,
    distanceM: Math.round(result.distanceM * 10) / 10,
    deviceId: body.deviceId,
    flagged: flags.length > 0,
    flagReason: describeFlags(flags),
    sourceUploadId: null,
    recordedById: null,
    note: existing?.status === "EXCUSED" ? "Checked in despite an approved excuse" : null,
  };
  if (existing) await repo.records.update(existing.id, data);
  else await repo.records.create({ id: `rec-${meeting.id.slice(4)}-${user.id.slice(4)}`, ...data });

  const [records, meetings] = await Promise.all([
    repo.records.list({ where: { userId: user.id } }),
    repo.meetings.list(),
  ]);
  const views = attendanceViews(records, meetings, {
    approvedAt: user.approvedAt,
    now,
    lateWeight: settings.lateWeight,
    thresholds: settings.bandThresholds,
  });
  return {
    ok: true,
    status: result.status,
    checkedInAt: data.checkedInAt!,
    distanceM: Math.round(result.distanceM),
    accuracyM: data.accuracyM!,
    flagged: data.flagged,
    percent: views.overall.percent,
    band: views.overall.band.label,
    meetingTitle: meeting.title,
  };
}
