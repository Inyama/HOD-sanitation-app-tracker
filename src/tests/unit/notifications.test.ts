import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import {
  applyQuietHours,
  dueNotifications,
  lowAttendanceCrossings,
  reminderPlan,
  type DueNotification,
  type SchedMeeting,
  type SchedPerson,
} from "@/lib/notifications/schedule";
import { fillMergeFields, renderNotification } from "@/lib/notifications/templates";
import { resolveAudience } from "@/lib/notifications/audience";
import { DEFAULT_NOTIF_PREFS } from "@/lib/repo/types";
import { lagosTime } from "@/lib/time/zone";

const sat: SchedMeeting = {
  id: "sat",
  type: "SATURDAY",
  startsAt: lagosTime(2026, 11, 7, 9, 30).toISO()!,
  status: "SCHEDULED",
  openBeforeMin: 60,
  closeAfterMin: 120,
};
const thu: SchedMeeting = {
  id: "thu",
  type: "THURSDAY_PRAYER",
  startsAt: lagosTime(2026, 11, 12, 20, 30).toISO()!,
  status: "SCHEDULED",
  openBeforeMin: 0,
  closeAfterMin: 0,
};
const evt: SchedMeeting = {
  id: "evt",
  type: "SPECIAL",
  startsAt: lagosTime(2026, 11, 28, 7, 30).toISO()!,
  status: "SCHEDULED",
  openBeforeMin: 60,
  closeAfterMin: 180,
};

const person = (id: string, extra: Partial<SchedPerson> = {}): SchedPerson => ({
  id,
  status: "ACTIVE",
  role: "MEMBER",
  isRemote: false,
  timezone: "Africa/Lagos",
  notifPrefs: { ...DEFAULT_NOTIF_PREFS },
  ...extra,
});
const people = [
  person("a"),
  person("b"),
  person("remote", { isRemote: true, timezone: "Europe/London" }),
  person("pending", { status: "PENDING" }),
];

const lagosLabel = (d: DateTime) => d.setZone("Africa/Lagos").toFormat("ccc HH:mm");

describe("reminder plan per meeting type (spec 8)", () => {
  it("Saturday: Friday 09:30, Saturday 08:30, 09:30, 11:15 and Sunday 09:00 follow-up", () => {
    expect(reminderPlan(sat).map((p) => [p.type, lagosLabel(p.at)])).toEqual([
      ["SAT_DAY_BEFORE", "Fri 09:30"],
      ["SAT_HOUR_BEFORE", "Sat 08:30"],
      ["SAT_LATE_NOTICE", "Sat 09:30"],
      ["SAT_WINDOW_CLOSING", "Sat 11:15"],
      ["ABSENCE_FOLLOWUP", "Sun 09:00"],
    ]);
  });
  it("Thursday: Wednesday 20:30, Thursday 19:30 and 20:30", () => {
    expect(reminderPlan(thu).map((p) => [p.type, lagosLabel(p.at)])).toEqual([
      ["THU_DAY_BEFORE", "Wed 20:30"],
      ["THU_HOUR_BEFORE", "Thu 19:30"],
      ["THU_STARTING", "Thu 20:30"],
    ]);
  });
  it("Special events: 24 hours and 1 hour before", () => {
    expect(reminderPlan(evt).map((p) => [p.type, lagosLabel(p.at)])).toEqual([
      ["EVENT_DAY_BEFORE", "Fri 07:30"],
      ["EVENT_HOUR_BEFORE", "Sat 06:30"],
    ]);
  });
  it("rescheduling moves reminders and cancelling removes them", () => {
    const moved = { ...sat, startsAt: lagosTime(2026, 11, 7, 10, 30).toISO()! };
    expect(lagosLabel(reminderPlan(moved)[1].at)).toBe("Sat 09:30");
    expect(reminderPlan({ ...sat, status: "CANCELLED" })).toEqual([]);
  });
});

describe("dueNotifications", () => {
  /** Run the scheduler once a minute across a range, feeding back what was sent. */
  function simulate(from: DateTime, minutes: number, meetings: SchedMeeting[], ppl = people) {
    const sent: DueNotification[] = [];
    for (let i = 0; i < minutes; i++) {
      sent.push(
        ...dueNotifications(
          from.plus({ minutes: i }),
          meetings,
          ppl,
          sent.map((s) => s.key),
        ),
      );
    }
    return sent;
  }

  it("fires Friday 09:30, Saturday 08:30, Wednesday 20:30 and Thursday 19:30 exactly once each", () => {
    const fri = simulate(lagosTime(2026, 11, 6, 9, 0), 60, [sat]);
    expect(
      fri
        .filter((n) => n.type === "SAT_DAY_BEFORE")
        .map((n) => n.userId)
        .sort(),
    ).toEqual(["a", "b"]);
    expect(fri.every((n) => lagosLabel(DateTime.fromISO(n.scheduledFor)) === "Fri 09:30")).toBe(true);

    const satMorning = simulate(lagosTime(2026, 11, 7, 8, 0), 60, [sat]);
    expect(satMorning.filter((n) => n.type === "SAT_HOUR_BEFORE")).toHaveLength(2);

    const wed = simulate(lagosTime(2026, 11, 11, 20, 0), 60, [thu]);
    expect(
      wed
        .filter((n) => n.type === "THU_DAY_BEFORE")
        .map((n) => n.userId)
        .sort(),
    ).toEqual(["a", "b", "remote"]);

    const thuEve = simulate(lagosTime(2026, 11, 12, 19, 0), 120, [thu]);
    expect(thuEve.filter((n) => n.type === "THU_HOUR_BEFORE")).toHaveLength(3);
    expect(thuEve.filter((n) => n.type === "THU_STARTING")).toHaveLength(3);
    // Re-running the same minute with the sent keys yields nothing.
    expect(
      dueNotifications(
        lagosTime(2026, 11, 12, 19, 30),
        [thu],
        people,
        thuEve.map((n) => n.key),
      ),
    ).toEqual([]);
  });

  it("sends the late notice only to people not checked in, and skips Remote members on Saturdays", () => {
    const due = dueNotifications(lagosTime(2026, 11, 7, 9, 30), [{ ...sat, checkedInUserIds: ["a"] }], people, []);
    expect(due.map((d) => [d.type, d.userId])).toEqual([["SAT_LATE_NOTICE", "b"]]);
  });

  it("produces nothing for a cancelled meeting", () => {
    expect(simulate(lagosTime(2026, 11, 6, 9, 0), 60 * 30, [{ ...sat, status: "CANCELLED" }])).toEqual([]);
  });

  it("uses the dedupe key userId:meetingId:type", () => {
    const due = dueNotifications(lagosTime(2026, 11, 6, 9, 30), [sat], people, []);
    expect(due.map((d) => d.key).sort()).toEqual(["a:sat:SAT_DAY_BEFORE", "b:sat:SAT_DAY_BEFORE"]);
  });

  it("only uses push for people who opted in; in-app is always on", () => {
    const due = dueNotifications(
      lagosTime(2026, 11, 6, 9, 30),
      [sat],
      [person("x", { notifPrefs: { ...DEFAULT_NOTIF_PREFS, push: true, email: false } }), person("y")],
      [],
    );
    expect(due.find((d) => d.userId === "x")!.channels).toEqual(["EMAIL", "IN_APP", "PUSH"]);
    expect(due.find((d) => d.userId === "y")!.channels).toEqual(["EMAIL", "IN_APP"]);
  });

  it("sends the absence follow-up on Sunday 09:00 to absent, unexcused people who want nudges", () => {
    const held = { ...sat, absentUnexcusedUserIds: ["a", "b"] };
    const ppl = [person("a"), person("b", { notifPrefs: { ...DEFAULT_NOTIF_PREFS, nudges: false } })];
    const due = dueNotifications(lagosTime(2026, 11, 8, 9, 0), [held], ppl, []);
    expect(due.map((d) => [d.type, d.userId])).toEqual([["ABSENCE_FOLLOWUP", "a"]]);
  });

  it("sends the weekly summary on Sunday 18:00 and defers it out of quiet hours abroad", () => {
    const ppl = [person("lagos"), person("tokyo", { timezone: "Asia/Tokyo" })];
    const due = dueNotifications(lagosTime(2026, 11, 8, 18, 0), [], ppl, []);
    expect(due.map((d) => d.userId)).toEqual(["lagos"]);
    // 18:00 Lagos is 02:00 in Tokyo: deferred to 06:00 Tokyo = 22:00 Lagos.
    const later = dueNotifications(
      lagosTime(2026, 11, 8, 22, 0),
      [],
      ppl,
      due.map((d) => d.key),
    );
    expect(later.map((d) => [d.type, d.userId])).toEqual([["WEEKLY_SUMMARY", "tokyo"]]);
  });
});

describe("quiet hours and low attendance", () => {
  it("defers only times inside quiet hours", () => {
    const q = { start: "22:00", end: "06:00" };
    const inQuiet = lagosTime(2026, 11, 8, 23, 15);
    expect(applyQuietHours(inQuiet, "Africa/Lagos", q).setZone("Africa/Lagos").toFormat("ccc HH:mm")).toBe("Mon 06:00");
    const day = lagosTime(2026, 11, 8, 12, 0);
    expect(applyQuietHours(day, "Africa/Lagos", q).toISO()).toBe(day.toISO());
  });
  it("reports people who drop below 60 percent after a meeting", () => {
    const before = new Map<string, number | null>([
      ["a", 61],
      ["b", 55],
      ["c", null],
    ]);
    const after = new Map<string, number | null>([
      ["a", 59.5],
      ["b", 52],
      ["c", 50],
    ]);
    expect(lowAttendanceCrossings(before, after)).toEqual(["a", "c"]);
  });
});

describe("templates", () => {
  it("fills merge fields and leaves unknown ones visible", () => {
    expect(fillMergeFields("Hi {first_name}, {percentage}% {unknown}", { first_name: "Grace", percentage: "94" })).toBe(
      "Hi Grace, 94% {unknown}",
    );
  });
  it("shows the recipient's time with Lagos time in brackets", () => {
    const t = renderNotification("THU_HOUR_BEFORE", {
      fullName: "Ruth Williams",
      timezone: "Europe/London",
      startsAt: thu.startsAt,
    });
    expect(t.body).toBe(
      "Hello Ruth, the Thursday Prayer Meeting starts in one hour, Thu 12 Nov, 7:30 pm (8:30 pm Lagos).",
    );
  });
  it("renders the sample 1-hour-before Saturday email", () => {
    const t = renderNotification("SAT_HOUR_BEFORE", {
      fullName: "Pastor Daniel Ojo",
      timezone: "Africa/Lagos",
      venueAddress: "7 Surulere Industrial Road, Off Adeniyi Jones, Ikeja, Lagos",
      percentage: 88,
    });
    expect(t.subject).toBe("Sanitation Meeting starts at 9:30 am. Check in when you arrive.");
    expect(t.body).toContain(
      "Hello Daniel, the Saturday Sanitation Meeting starts in one hour at 7 Surulere Industrial Road",
    );
    expect(t.body).toContain("Your attendance is currently 88 percent.");
  });
});

describe("audiences", () => {
  const ppl = [
    {
      id: "m1",
      role: "MEMBER" as const,
      status: "ACTIVE" as const,
      teamIds: ["t1"],
      band: "gold" as const,
      absentLastSaturday: false,
    },
    {
      id: "m2",
      role: "MEMBER" as const,
      status: "ACTIVE" as const,
      teamIds: ["t2"],
      band: "amber" as const,
      absentLastSaturday: true,
    },
    {
      id: "v1",
      role: "VOLUNTEER" as const,
      status: "ACTIVE" as const,
      teamIds: ["t1"],
      band: "gold" as const,
      absentLastSaturday: true,
    },
    {
      id: "p1",
      role: "MEMBER" as const,
      status: "PENDING" as const,
      teamIds: [],
      band: "none" as const,
      absentLastSaturday: false,
    },
  ];
  it.each([
    [{ kind: "EVERYONE" as const }, ["m1", "m2", "v1"]],
    [{ kind: "ALL_MEMBERS" as const }, ["m1", "m2"]],
    [{ kind: "ALL_VOLUNTEERS" as const }, ["v1"]],
    [{ kind: "TEAM" as const, teamId: "t1" }, ["m1", "v1"]],
    [{ kind: "BAND" as const, band: "gold" as const }, ["m1", "v1"]],
    [{ kind: "ABSENT_LAST_SATURDAY" as const }, ["m2", "v1"]],
    [{ kind: "HAND_PICKED" as const, userIds: ["m2", "p1"] }, ["m2"]],
  ])("%o reaches exactly the right people", (spec, ids) => {
    expect(resolveAudience(spec, ppl)).toEqual(ids);
  });
});
