import { DateTime } from "luxon";
import type { AttendanceRecord, Meeting, User } from "@/lib/repo/types";

/**
 * Marshal live lists (spec 7.3): who is present, late and still expected for a meeting.
 * Expected = active people approved before the meeting who are not Remote (for Saturdays)
 * and have not checked in or been excused.
 */

export interface LivePerson {
  userId: string;
  name: string;
  role: User["role"];
  checkedInAt: string | null;
  method: AttendanceRecord["method"] | null;
  flagged: boolean;
}

export interface LiveLists {
  present: LivePerson[];
  late: LivePerson[];
  expected: LivePerson[];
  excused: number;
}

export function liveLists(
  meeting: Pick<Meeting, "id" | "type" | "startsAt">,
  people: User[],
  records: AttendanceRecord[],
): LiveLists {
  const start = DateTime.fromISO(meeting.startsAt);
  const recs = new Map(records.filter((r) => r.meetingId === meeting.id).map((r) => [r.userId, r]));
  const eligible = people.filter(
    (u) =>
      u.status === "ACTIVE" &&
      u.approvedAt &&
      DateTime.fromISO(u.approvedAt) <= start.plus({ hours: 3 }) &&
      !(meeting.type === "SATURDAY" && u.isRemote),
  );
  const row = (u: User): LivePerson => {
    const r = recs.get(u.id);
    return {
      userId: u.id,
      name: u.name,
      role: u.role,
      checkedInAt: r?.checkedInAt ?? null,
      method: r?.method ?? null,
      flagged: !!r?.flagged,
    };
  };
  const byTime = (a: LivePerson, b: LivePerson) => (a.checkedInAt ?? "").localeCompare(b.checkedInAt ?? "");
  const byName = (a: LivePerson, b: LivePerson) => a.name.localeCompare(b.name);
  return {
    present: eligible
      .filter((u) => recs.get(u.id)?.status === "ON_TIME")
      .map(row)
      .sort(byTime),
    late: eligible
      .filter((u) => recs.get(u.id)?.status === "LATE")
      .map(row)
      .sort(byTime),
    expected: eligible
      .filter((u) => !recs.has(u.id) || recs.get(u.id)!.status === "ABSENT")
      .map(row)
      .sort(byName),
    excused: eligible.filter((u) => recs.get(u.id)?.status === "EXCUSED").length,
  };
}
