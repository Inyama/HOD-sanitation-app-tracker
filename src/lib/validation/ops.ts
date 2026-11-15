import { z } from "zod";
import { MAX_RADIUS_M, MIN_RADIUS_M } from "@/lib/attendance/geofence";
import { MAX_REPEAT_WEEKS } from "@/lib/admin/meetings";

/** Admin operations request schemas (spec 7.4 items 2, 6 to 9, 13 to 15; spec 11). */

const id = z.string().min(3).max(80);
const reason = (what: string) =>
  z.string().trim().min(5, `Give a short reason for ${what} (at least 5 characters).`).max(300);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time.");
const status = z.enum(["ON_TIME", "LATE", "ABSENT", "EXCUSED"]);

// ---- Uploads -------------------------------------------------------------------------------

const columnMap = z
  .object({
    name: z.number().int().min(0).max(200).optional(),
    email: z.number().int().min(0).max(200).optional(),
    phone: z.number().int().min(0).max(200).optional(),
    time: z.number().int().min(0).max(200).optional(),
    status: z.number().int().min(0).max(200).optional(),
  })
  .optional();

const fileFields = {
  name: z.string().trim().min(1).max(160),
  size: z.number().int().min(1),
  /** Base64 without a data: prefix; 5 MB of file is about 6.7 MB of base64. */
  data: z.string().min(4).max(7_200_000),
};

export const inspectUploadBody = z.object(fileFields);

export const createUploadBody = z.object({ ...fileFields, meetingId: id, mapping: columnMap });

export const resolveRowBody = z.object({
  resolution: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("ACCEPT") }),
      z.object({ kind: z.literal("IGNORE") }),
      z.object({ kind: z.literal("ASSIGN"), userId: id }),
    ])
    .nullable(),
});

export const confirmUploadBody = z.object({ replace: z.boolean().default(false) });

// ---- Meetings ------------------------------------------------------------------------------

export const meetingBody = z
  .object({
    type: z.enum(["SATURDAY", "THURSDAY_PRAYER", "SPECIAL"]),
    title: z.string().trim().min(3, "Give the meeting a title.").max(100),
    date,
    time,
    durationMin: z.number().int().min(15, "At least 15 minutes.").max(720, "At most 12 hours."),
    method: z.enum(["GEO", "SHEET", "BOTH"]),
    openBeforeMin: z.number().int().min(0).max(180, "At most 3 hours."),
    closeAfterMin: z.number().int().min(0).max(240, "At most 4 hours."),
    graceMinutes: z.number().int().min(0).max(30, "At most 30 minutes."),
    radiusM: z
      .number()
      .int()
      .min(MIN_RADIUS_M, `At least ${MIN_RADIUS_M} m.`)
      .max(MAX_RADIUS_M, `At most ${MAX_RADIUS_M} m.`)
      .nullable(),
    requireQr: z.boolean(),
    repeatWeeks: z.number().int().min(1).max(MAX_REPEAT_WEEKS, `At most ${MAX_REPEAT_WEEKS} weeks.`),
  })
  .superRefine((v, ctx) => {
    if (v.method !== "SHEET" && v.closeAfterMin < 30)
      ctx.addIssue({
        code: "custom",
        path: ["closeAfterMin"],
        message: "Keep check-in open at least 30 minutes after the start.",
      });
  });
export type MeetingBody = z.infer<typeof meetingBody>;

/** Editing keeps the date and time (use reschedule to move it) and never repeats. */
export const meetingEditBody = z.object({
  title: z.string().trim().min(3, "Give the meeting a title.").max(100),
  durationMin: z.number().int().min(15).max(720),
  method: z.enum(["GEO", "SHEET", "BOTH"]),
  openBeforeMin: z.number().int().min(0).max(180),
  closeAfterMin: z.number().int().min(0).max(240),
  graceMinutes: z.number().int().min(0).max(30),
  radiusM: z.number().int().min(MIN_RADIUS_M).max(MAX_RADIUS_M).nullable(),
  requireQr: z.boolean(),
});
export type MeetingEditBody = z.infer<typeof meetingEditBody>;

export const meetingActionBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel"), reason: reason("cancelling") }),
  z.object({ action: z.literal("reschedule"), date, time, reason: reason("moving it") }),
  z.object({ action: z.literal("edit"), changes: meetingEditBody }),
]);

export const meetingsQuery = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

// ---- Excuses -------------------------------------------------------------------------------

export const excuseDecisionBody = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVED"), note: z.string().trim().max(300).optional() }),
  z.object({ decision: z.literal("DECLINED"), note: reason("declining") }),
]);

// ---- Corrections ---------------------------------------------------------------------------

export const correctionBody = z.object({
  status,
  reason: reason("the change"),
  arrivedAt: time.nullable().optional(),
});

export const reviewFlagBody = z.object({ note: z.string().trim().max(300).optional() });

export const disputeDecisionBody = z.discriminatedUnion("accept", [
  z.object({ accept: z.literal(true), status, arrivedAt: time.nullable().optional(), note: reason("the decision") }),
  z.object({ accept: z.literal(false), note: reason("the decision") }),
]);

export const disputeCreateBody = z.object({
  meetingId: id,
  claimed: status,
  message: z.string().trim().min(10, "Tell us what happened (at least 10 characters).").max(600),
});

// ---- Roster --------------------------------------------------------------------------------

export const rosterQuery = z.object({ meetingId: id.optional() });

export const rosterBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign"), meetingId: id, userId: id, zoneId: id }),
  z.object({ action: z.literal("remove"), dutyId: id }),
  z.object({
    action: z.literal("applySuggestions"),
    meetingId: id,
    picks: z
      .array(z.object({ userId: id, zoneId: id }))
      .min(1)
      .max(40),
  }),
  z.object({ action: z.literal("publish"), meetingId: id }),
  z.object({ action: z.literal("swap"), dutyId: id, approve: z.boolean() }),
]);

// ---- Reports and analytics ----------------------------------------------------------------

export const reportQuery = z.object({
  type: z.enum(["REGISTER", "MEMBER_SUMMARY", "LATE", "ABSENTEES", "HOURS", "LEADERSHIP"]),
  range: z.string().max(40).optional(),
  meetingType: z.enum(["ALL", "SATURDAY", "THURSDAY_PRAYER", "SPECIAL"]).default("ALL"),
  teamId: z.string().max(80).default("ALL"),
  userId: z.string().max(80).optional(),
  format: z.enum(["json", "csv", "xlsx", "pdf"]).default("json"),
});
export type ReportQuery = z.infer<typeof reportQuery>;

export const analyticsQuery = z.object({
  range: z.string().max(40).optional(),
  meetingType: z.enum(["ALL", "SATURDAY", "THURSDAY_PRAYER", "SPECIAL"]).default("ALL"),
  teamId: z.string().max(80).default("ALL"),
});

export const liveQuery = z.object({ meetingId: id.optional() });
