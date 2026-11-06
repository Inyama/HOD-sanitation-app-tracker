import "server-only";
import { DateTime } from "luxon";
import type { AttendanceRecord, Meeting, User } from "@/lib/repo/types";
import { repo } from "@/lib/repo";
import { attendanceViews, countedMeetings, currentStreak, longestStreak } from "@/lib/attendance/aggregate";
import { nextMeeting, withRecurringMeetings } from "@/lib/time/schedule";

/**
 * Everything the member screens need about one person, computed with the shared src/lib rules.
 * Meetings include the weekly Saturday and Thursday occurrences for the next 8 weeks.
 */
export async function loadMemberData(user: User, now: DateTime) {
  const r = repo();
  const [stored, records, settings, venues] = await Promise.all([
    r.meetings.list({ orderBy: { field: "startsAt" } }),
    r.records.list({ where: { userId: user.id } }),
    r.settings.get(),
    r.venues.list(),
  ]);
  const meetings = withRecurringMeetings(stored, now, 8);
  const venue = venues.find((v) => v.id === settings.venueId) ?? venues[0];
  const opts = {
    approvedAt: user.approvedAt,
    now,
    lateWeight: settings.lateWeight,
    thresholds: settings.bandThresholds,
  };
  const views = attendanceViews(records, meetings, opts);
  const counted = countedMeetings(records, meetings, { approvedAt: user.approvedAt, now });
  const geoMeetings = meetings.filter((m) => m.method !== "SHEET" && !(user.isRemote && m.type === "SATURDAY"));
  const nextGeo = nextMeeting(geoMeetings, now);
  const recordFor = (meetingId: string | undefined): AttendanceRecord | null =>
    meetingId ? (records.find((x) => x.meetingId === meetingId) ?? null) : null;
  return {
    settings,
    venue: {
      name: venue.name,
      address: venue.address,
      lat: venue.lat,
      lng: venue.lng,
      radiusM: venue.radiusM,
      verified: venue.verified,
    },
    meetings,
    records,
    views,
    counted,
    currentStreak: currentStreak(counted),
    longestStreak: longestStreak(counted),
    next: nextMeeting(meetings, now),
    nextGeo,
    nextGeoRecord: recordFor(nextGeo?.id),
    upcoming: meetings.filter(
      (m) => DateTime.fromISO(m.startsAt) >= now.minus({ minutes: 120 }) && m.status !== "CANCELLED",
    ),
  };
}

export type MemberData = Awaited<ReturnType<typeof loadMemberData>>;

/** Fields of a meeting that are safe and useful to send to the browser. */
export function publicMeeting(m: Meeting) {
  return {
    id: m.id,
    type: m.type,
    title: m.title,
    startsAt: m.startsAt,
    endsAt: m.endsAt,
    status: m.status,
    statusNote: m.statusNote,
    method: m.method,
    graceMinutes: m.graceMinutes,
    openBeforeMin: m.openBeforeMin,
    closeAfterMin: m.closeAfterMin,
    requireQr: m.requireQr,
  };
}
export type PublicMeeting = ReturnType<typeof publicMeeting>;
