import "server-only";
import { DateTime } from "luxon";
import type { Repository } from "@/lib/repo/interfaces";
import type { Meeting } from "@/lib/repo/types";
import { windowPhase } from "@/lib/attendance/status";
import { liveLists } from "@/lib/volunteer/marshal";
import { meetingsBetween } from "@/lib/time/schedule";

/**
 * Live Saturday board (spec 7.4 item 2): the meeting whose window is open (or the next one),
 * counters, check-in dots for the map and the live list with teams and flags.
 */

const utc = (iso: string) => DateTime.fromISO(iso, { zone: "utc" });

function windowOf(m: Meeting) {
  const start = utc(m.startsAt);
  return { opens: start.minus({ minutes: m.openBeforeMin }), closes: start.plus({ minutes: m.closeAfterMin }) };
}

/** Geolocation meetings from two weeks back to two weeks ahead, newest first for choosing. */
async function liveCandidates(repo: Repository, now: DateTime) {
  const all = meetingsBetween(await repo.meetings.list(), now.minus({ weeks: 2 }), now.plus({ weeks: 2 }));
  return all.filter((m) => m.method !== "SHEET" && m.status !== "CANCELLED");
}

export async function loadLiveBoard(repo: Repository, now: DateTime, meetingId?: string) {
  const candidates = await liveCandidates(repo, now);
  const open = candidates.find((m) => {
    const w = windowOf(m);
    return w.opens <= now && now <= w.closes;
  });
  const next = candidates.find((m) => windowOf(m).closes >= now);
  const chosen = candidates.find((m) => m.id === meetingId) ?? open ?? next ?? candidates.at(-1) ?? null;
  const [settings, venues] = await Promise.all([repo.settings.get(), repo.venues.list()]);
  const venue = venues.find((v) => v.id === settings.venueId) ?? venues[0];
  const options = candidates
    .filter((m) => utc(m.startsAt) <= now.plus({ weeks: 1 }))
    .map((m) => ({ id: m.id, title: m.title, startsAt: m.startsAt }))
    .reverse();
  if (!chosen) return { meeting: null, options, venue: null, at: now.toISO()! };

  const [users, records, teams, teamMembers] = await Promise.all([
    repo.users.list(),
    repo.records.list({ where: { meetingId: chosen.id } }),
    repo.teams.list({ orderBy: { field: "name" } }),
    repo.teamMembers.list(),
  ]);
  const lists = liveLists(chosen, users, records);
  const teamOf = new Map(teamMembers.map((t) => [t.userId, t.teamId]));
  const recordOf = new Map(records.map((r) => [r.userId, r]));
  const phase = windowPhase(now, utc(chosen.startsAt), {
    graceMinutes: chosen.graceMinutes,
    openBeforeMinutes: chosen.openBeforeMin,
    closeAfterMinutes: chosen.closeAfterMin,
  });
  const person = (p: (typeof lists.present)[number], state: "ON_TIME" | "LATE" | "NOT_YET") => {
    const r = recordOf.get(p.userId);
    return {
      userId: p.userId,
      name: p.name,
      role: p.role,
      state,
      teamId: teamOf.get(p.userId) ?? null,
      checkedInAt: p.checkedInAt,
      method: p.method,
      flagged: p.flagged,
      flagReason: r?.flagReason ?? null,
      distanceM: r?.distanceM === null || r?.distanceM === undefined ? null : Math.round(r.distanceM),
    };
  };
  const people = [
    ...lists.present.map((p) => person(p, "ON_TIME")),
    ...lists.late.map((p) => person(p, "LATE")),
    ...lists.expected.map((p) => person(p, "NOT_YET")),
  ];
  const dots = records
    .filter((r) => r.lat !== null && r.lng !== null && (r.status === "ON_TIME" || r.status === "LATE"))
    .map((r) => ({
      id: r.id,
      lat: r.lat!,
      lng: r.lng!,
      status: r.status as "ON_TIME" | "LATE",
      flagged: r.flagged,
      name: users.find((u) => u.id === r.userId)?.name ?? "Someone",
      teamId: teamOf.get(r.userId) ?? null,
    }));
  return {
    meeting: {
      id: chosen.id,
      title: chosen.title,
      startsAt: chosen.startsAt,
      opensAt: windowOf(chosen).opens.toISO()!,
      closesAt: windowOf(chosen).closes.toISO()!,
      status: chosen.status,
      phase,
    },
    options,
    venue: venue
      ? { name: venue.name, lat: venue.lat, lng: venue.lng, radiusM: chosen.radiusM ?? venue.radiusM }
      : null,
    teams: teams.map((t) => ({ id: t.id, name: t.name })),
    people,
    dots,
    excused: lists.excused,
    at: now.toISO()!,
  };
}

export type LiveBoardData = Awaited<ReturnType<typeof loadLiveBoard>>;
