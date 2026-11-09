import "server-only";
import { DateTime } from "luxon";
import type { User } from "@/lib/repo/types";
import { repo } from "@/lib/repo";
import { withRecurringMeetings } from "@/lib/time/schedule";
import { formatClock } from "@/lib/time/zone";
import { arrivalTime, holdsSpot } from "./duties";
import { zoneInfo } from "./zones";
import { summarizeHours } from "./hours";
import { upcomingSaturdays } from "./service";

/** What the volunteer home and events screens need (spec 7.3). */
export async function loadVolunteerContext(user: User, now: DateTime) {
  const r = repo();
  const [stored, duties, zones, teams, teamMembers, users, announcements, rsvps, hours, titles] = await Promise.all([
    r.meetings.list({ orderBy: { field: "startsAt" } }),
    r.duties.list({ where: { userId: user.id } }),
    r.zones.list(),
    r.teams.list(),
    r.teamMembers.list(),
    r.users.list(),
    r.announcements.list({ orderBy: { field: "createdAt", dir: "desc" } }),
    r.rsvps.list({ where: { userId: user.id } }),
    r.serviceHours.list({ where: { userId: user.id } }),
    r.userTitles.list(),
  ]);
  const saturdays = await upcomingSaturdays(r, now, 2);
  const nextSat = saturdays[0] ?? null;
  const duty = nextSat ? duties.find((d) => d.meetingId === nextSat.id && holdsSpot(d.status)) : undefined;
  const zone = duty ? zones.find((z) => z.id === duty.zoneId) : undefined;
  const myTeam = teams.find((t) => teamMembers.some((m) => m.teamId === t.id && m.userId === user.id));
  const zoneTeam = zone
    ? (teams.find((t) => t.zoneId === zone.id && t.id === myTeam?.id) ?? teams.find((t) => t.zoneId === zone.id))
    : undefined;
  const captain = titles.find((t) => t.title === "ZONE_CAPTAIN");
  const supervisorId = zoneTeam?.leadUserId ?? captain?.userId;
  const supervisor = supervisorId && supervisorId !== user.id ? users.find((u) => u.id === supervisorId) : undefined;
  const info = zone ? zoneInfo(zone.name) : null;

  const meetings = withRecurringMeetings(stored, now, 6);
  const upcoming = meetings.filter(
    (m) =>
      m.status !== "CANCELLED" && DateTime.fromISO(m.startsAt).plus({ minutes: Math.max(m.closeAfterMin, 90) }) >= now,
  );
  const weekAgo = now.minus({ days: 7 });

  return {
    nextSaturday: nextSat,
    duty:
      duty && zone && nextSat && info
        ? {
            id: duty.id,
            status: duty.status,
            zone: zone.name,
            zoneDescription: zone.description,
            team: zoneTeam?.name ?? myTeam?.name ?? null,
            supervisor: supervisor?.name ?? (supervisorId === user.id ? "You lead this zone" : null),
            arrival: formatClock(arrivalTime(nextSat.startsAt, zone.name)),
            supplies: info.supplies,
            tasks: info.tasks,
          }
        : null,
    myTeam: myTeam?.name ?? null,
    upcoming,
    rsvps: Object.fromEntries(rsvps.map((x) => [x.meetingId, x.answer])) as Record<string, "GOING" | "MAYBE" | "NO">,
    updates: announcements
      .filter((a) => a.pinned || DateTime.fromISO(a.createdAt) >= now.minus({ days: 45 }))
      .map((a) => ({
        ...a,
        isNew: DateTime.fromISO(a.createdAt) >= weekAgo,
        author: users.find((u) => u.id === a.authorId)?.name ?? "Unit admin",
      }))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt)),
    hours: summarizeHours(hours, now),
  };
}
