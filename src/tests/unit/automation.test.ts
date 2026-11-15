import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { DEFAULT_NOTIF_PREFS } from "@/lib/repo/types";
import {
  dueNotifications,
  dueNotificationsBetween,
  type SchedMeeting,
  type SchedPerson,
} from "@/lib/notifications/schedule";
import {
  automationConfig,
  effectiveTemplate,
  nextRetry,
  ruleLookup,
  schedulerWindow,
  upcomingSchedule,
} from "@/lib/notifications/automation";
import { escalations } from "@/lib/notifications/escalation";
import { parseRichText, richTextToHtml, richTextToPlain } from "@/lib/notifications/richtext";
import { resolveAudience, type AudiencePerson } from "@/lib/notifications/audience";
import { fillMergeFields, renderNotification } from "@/lib/notifications/templates";

const lagos = (iso: string) => DateTime.fromISO(iso, { zone: "Africa/Lagos" });
const sat: SchedMeeting = {
  id: "mtg-2026-11-14-sat",
  type: "SATURDAY",
  startsAt: lagos("2026-11-14T09:30").toUTC().toISO()!,
  status: "SCHEDULED",
  openBeforeMin: 60,
  closeAfterMin: 120,
};
const thu: SchedMeeting = {
  ...sat,
  id: "mtg-2026-11-12-thu",
  type: "THURSDAY_PRAYER",
  startsAt: lagos("2026-11-12T20:30").toUTC().toISO()!,
};
const person = (id: string, over: Partial<SchedPerson> = {}): SchedPerson => ({
  id,
  status: "ACTIVE",
  role: "MEMBER",
  isRemote: false,
  timezone: "Africa/Lagos",
  notifPrefs: { ...DEFAULT_NOTIF_PREFS, quietHours: null },
  ...over,
});

describe("scheduler windows", () => {
  it("catches up the minutes since the last run, at most the look-back limit", () => {
    const now = lagos("2026-11-13T09:31");
    expect(schedulerWindow(null, now).from.toMillis()).toBe(now.minus({ minutes: 1 }).toMillis());
    expect(schedulerWindow(lagos("2026-11-13T09:28").toISO(), now).from.toMillis()).toBe(
      lagos("2026-11-13T09:28").toMillis(),
    );
    expect(schedulerWindow(lagos("2026-11-13T08:00").toISO(), now).from.toMillis()).toBe(
      now.minus({ minutes: 15 }).toMillis(),
    );
    // The demo clock moved back: only the current minute.
    expect(schedulerWindow(lagos("2026-11-20T08:00").toISO(), now).from.toMillis()).toBe(
      now.minus({ minutes: 1 }).toMillis(),
    );
  });

  it("a window sends each reminder exactly once, even across overlapping runs", () => {
    const people = [person("a"), person("b")];
    const first = dueNotificationsBetween(lagos("2026-11-13T09:25"), lagos("2026-11-13T09:35"), [sat], people, []);
    expect(first.map((d) => `${d.userId}:${d.type}`).sort()).toEqual(["a:SAT_DAY_BEFORE", "b:SAT_DAY_BEFORE"]);
    const again = dueNotificationsBetween(
      lagos("2026-11-13T09:29"),
      lagos("2026-11-13T09:40"),
      [sat],
      people,
      first.map((d) => d.key),
    );
    expect(again).toEqual([]);
  });

  it("the per-minute form still fires at Friday 9:30, Saturday 8:30, Wednesday 8:30 pm and Thursday 7:30 pm", () => {
    const p = [person("a")];
    const at = (iso: string) => dueNotifications(lagos(iso), [sat, thu], p, []).map((d) => d.type);
    expect(at("2026-11-13T09:30")).toEqual(["SAT_DAY_BEFORE"]);
    expect(at("2026-11-14T08:30")).toEqual(["SAT_HOUR_BEFORE"]);
    expect(at("2026-11-11T20:30")).toEqual(["THU_DAY_BEFORE"]);
    expect(at("2026-11-12T19:30")).toEqual(["THU_HOUR_BEFORE"]);
    expect(at("2026-11-13T09:31")).toEqual([]);
  });

  it("admin switches turn a type off or drop its email", () => {
    const off = ruleLookup({
      automation: {
        rules: { SAT_DAY_BEFORE: { enabled: false, email: true, push: true, subject: null, title: null, body: null } },
        escalation: { enabled: true, absences: 2 },
      },
    });
    expect(dueNotifications(lagos("2026-11-13T09:30"), [sat], [person("a")], [], off)).toEqual([]);
    const noEmail = ruleLookup({
      automation: {
        rules: { SAT_DAY_BEFORE: { enabled: true, email: false, push: true, subject: null, title: null, body: null } },
        escalation: { enabled: true, absences: 2 },
      },
    });
    expect(dueNotifications(lagos("2026-11-13T09:30"), [sat], [person("a")], [], noEmail)[0].channels).toEqual([
      "IN_APP",
    ]);
  });
});

describe("automation settings", () => {
  it("fills every type with defaults and keeps overrides", () => {
    const c = automationConfig({});
    expect(Object.keys(c.rules)).toHaveLength(12);
    expect(c.rules.SAT_LATE_NOTICE).toMatchObject({ enabled: true, email: false, push: true });
    expect(c.escalation).toEqual({ enabled: true, absences: 2 });
    const t = effectiveTemplate("SAT_HOUR_BEFORE", { subject: null, title: "Doors open", body: null });
    expect(t.title).toBe("Doors open");
    expect(t.subject).toContain("9:30 am");
  });

  it("an override template is rendered with the merge fields", () => {
    const t = renderNotification(
      "SAT_DAY_BEFORE",
      { fullName: "Pastor Daniel Ojo", timezone: "Europe/London", startsAt: sat.startsAt, percentage: 91.2 },
      { subject: "Hi {first_name}", title: "T", body: "{local_start_time} · {percentage}%" },
    );
    expect(t.subject).toBe("Hi Daniel");
    expect(t.body).toContain("(9:30 am Lagos)");
    expect(t.body).toContain("91.2%");
  });

  it("the coming schedule follows the meeting: moved meetings move, cancelled ones disappear", () => {
    const now = lagos("2026-11-10T12:00");
    const lookup = ruleLookup({});
    const items = upcomingSchedule([{ ...sat, title: "Saturday" }], now, 7, lookup);
    expect(items.map((i) => i.type)).toEqual([
      "SAT_DAY_BEFORE",
      "SAT_HOUR_BEFORE",
      "SAT_LATE_NOTICE",
      "SAT_WINDOW_CLOSING",
      "ABSENCE_FOLLOWUP",
    ]);
    const moved = upcomingSchedule(
      [{ ...sat, title: "Saturday", startsAt: lagos("2026-11-15T10:00").toUTC().toISO()! }],
      now,
      7,
      lookup,
    );
    expect(DateTime.fromISO(moved[0].at).setZone("Africa/Lagos").toFormat("ccc HH:mm")).toBe("Sat 10:00");
    expect(upcomingSchedule([{ ...sat, title: "Saturday", status: "CANCELLED" }], now, 7, lookup)).toEqual([]);
  });

  it("failed emails back off 1, 2, 4, 8 minutes and stop after five tries", () => {
    const t = lagos("2026-11-10T12:00");
    expect([1, 2, 3, 4].map((n) => nextRetry(n, t)!.diff(t, "minutes").minutes)).toEqual([1, 2, 4, 8]);
    expect(nextRetry(5, t)).toBeNull();
  });
});

describe("escalation", () => {
  it("tells each Team Lead once when absences reach the threshold, never the person themself", () => {
    const list = escalations(
      "mtg-1",
      [
        { userId: "u1", name: "Ada", absencesInARow: 2, leadIds: ["lead", "lead"] },
        { userId: "u2", name: "Ben", absencesInARow: 1, leadIds: ["lead"] },
        { userId: "lead", name: "Lead", absencesInARow: 3, leadIds: ["lead"] },
      ],
      2,
    );
    expect(list).toEqual([{ leadId: "lead", userId: "u1", name: "Ada", absences: 2, key: "lead:mtg-1:ESCALATION:u1" }]);
  });
});

describe("rich text", () => {
  it("parses bold, italic, links and bullet lists", () => {
    const blocks = parseRichText("Hello **team**, *thanks*.\n\n- One\n- [Two](https://example.com)");
    expect(blocks[0]).toEqual({
      kind: "p",
      spans: [
        { text: "Hello " },
        { text: "team", bold: true },
        { text: ", " },
        { text: "thanks", italic: true },
        { text: "." },
      ],
    });
    expect(blocks[1]).toEqual({
      kind: "ul",
      items: [[{ text: "One" }], [{ text: "Two", href: "https://example.com" }]],
    });
  });

  it("escapes markup and refuses unsafe links", () => {
    const html = richTextToHtml('<script>alert(1)</script> [x](javascript:alert(1)) "q"', "Arial");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain('href="javascript');
    expect(richTextToPlain("See [the guide](https://example.com/g)\n\n- a\n- b")).toBe(
      "See the guide (https://example.com/g)\n\n• a\n• b",
    );
  });
});

describe("audiences and merge fields", () => {
  const people: AudiencePerson[] = [
    { id: "1", role: "MEMBER", status: "ACTIVE", teamIds: ["t1"], band: "amber", absentLastSaturday: true },
    { id: "2", role: "VOLUNTEER", status: "ACTIVE", teamIds: ["t1"], band: "gold", absentLastSaturday: false },
    { id: "3", role: "MEMBER", status: "SUSPENDED", teamIds: [], band: "amber", absentLastSaturday: true },
    { id: "4", role: "MEMBER", status: "ACTIVE", teamIds: [], band: "red", absentLastSaturday: false },
  ];
  it("a percentage band reaches exactly the active people in it", () => {
    expect(resolveAudience({ kind: "BAND", band: "amber" }, people)).toEqual(["1"]);
    expect(resolveAudience({ kind: "ABSENT_LAST_SATURDAY" }, people)).toEqual(["1"]);
    expect(resolveAudience({ kind: "TEAM", teamId: "t1" }, people)).toEqual(["1", "2"]);
    expect(resolveAudience({ kind: "HAND_PICKED", userIds: ["3", "4"] }, people)).toEqual(["4"]);
    expect(fillMergeFields("Hi {first_name}, {percentage}% · {unknown}", { first_name: "Ada", percentage: "88" })).toBe(
      "Hi Ada, 88% · {unknown}",
    );
  });
});
