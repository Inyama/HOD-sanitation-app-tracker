import { z } from "zod";

/** Messaging and automation request schemas (spec 7.4 items 10 and 11, spec 11). */

const id = z.string().min(3).max(80);

export const audienceSpec = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("EVERYONE") }),
  z.object({ kind: z.literal("ALL_MEMBERS") }),
  z.object({ kind: z.literal("ALL_VOLUNTEERS") }),
  z.object({ kind: z.literal("TEAM"), teamId: id }),
  z.object({ kind: z.literal("BAND"), band: z.enum(["gold", "green", "amber", "red"]) }),
  z.object({ kind: z.literal("ABSENT_LAST_SATURDAY") }),
  z.object({ kind: z.literal("HAND_PICKED"), userIds: z.array(id).min(1, "Choose at least one person.").max(500) }),
]);

export const messageBody = z
  .object({
    audience: audienceSpec.optional(),
    /** Older form used by quick messages: the same as a hand-picked audience. */
    userIds: z.array(id).min(1, "Choose at least one person.").max(500).optional(),
    subject: z.string().trim().min(3, "Add a subject.").max(120),
    body: z.string().trim().min(5, "Write the message (at least 5 characters).").max(5000),
    channels: z
      .array(z.enum(["IN_APP", "EMAIL"]))
      .min(1, "Choose at least one channel.")
      .default(["IN_APP", "EMAIL"]),
    /** Lagos local date and time "yyyy-MM-ddTHH:mm"; empty or missing sends now. */
    scheduledFor: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time.")
      .nullable()
      .optional(),
    attachments: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(120),
          url: z.string().regex(/^\/api\/v1\/files\/[\w-]+$/),
          size: z.string().max(20),
        }),
      )
      .max(5, "Attach at most 5 files.")
      .optional(),
    templateKey: z.string().max(40).nullable().optional(),
  })
  .refine((v) => v.audience || v.userIds, { message: "Choose who receives the message.", path: ["audience"] });
export type MessageBody = z.infer<typeof messageBody>;

export const announcementBody = z.object({
  title: z.string().trim().min(3, "Add a title.").max(120),
  body: z.string().trim().min(5, "Write the announcement (at least 5 characters).").max(2000),
  pinned: z.boolean().default(false),
  notify: z.boolean().default(false),
});

export const announcementPatch = z
  .object({
    title: z.string().trim().min(3).max(120).optional(),
    body: z.string().trim().min(5).max(2000).optional(),
    pinned: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Change at least one field.");

const notificationType = z.enum([
  "SAT_DAY_BEFORE",
  "SAT_HOUR_BEFORE",
  "SAT_LATE_NOTICE",
  "SAT_WINDOW_CLOSING",
  "THU_DAY_BEFORE",
  "THU_HOUR_BEFORE",
  "THU_STARTING",
  "ABSENCE_FOLLOWUP",
  "WEEKLY_SUMMARY",
  "LOW_ATTENDANCE",
  "EVENT_DAY_BEFORE",
  "EVENT_HOUR_BEFORE",
]);

const templateText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

export const automationPatch = z.discriminatedUnion("target", [
  z.object({
    target: z.literal("rule"),
    type: notificationType,
    enabled: z.boolean().optional(),
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    subject: templateText(160).optional(),
    title: templateText(80).optional(),
    body: templateText(1000).optional(),
  }),
  z.object({
    target: z.literal("escalation"),
    enabled: z.boolean(),
    absences: z.number().int().min(2, "At least 2.").max(10, "At most 10."),
  }),
]);

export const automationTestBody = z.object({ type: notificationType });

export const deliveryQuery = z.object({
  status: z.enum(["ALL", "SENT", "FAILED", "SKIPPED"]).default("ALL"),
  type: z.string().max(40).default("ALL"),
});
