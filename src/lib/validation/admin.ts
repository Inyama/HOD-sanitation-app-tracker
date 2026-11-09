import { z } from "zod";
import { isValidZone } from "@/lib/time/zone";
import { MAX_RADIUS_M, MIN_RADIUS_M } from "@/lib/attendance/geofence";

/** Admin request schemas (spec 11: Zod on every body and query). */

const id = z.string().min(3).max(80);
const reason = (what: string) =>
  z.string().trim().min(5, `Give a short reason for ${what} (at least 5 characters).`).max(300);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const memberListQuery = z.object({
  q: z.string().max(100).optional(),
  role: z.enum(["ALL", "MEMBER", "VOLUNTEER", "ADMIN"]).optional(),
  status: z.enum(["ALL", "PENDING", "ACTIVE", "SUSPENDED", "REMOVED"]).optional(),
  teamId: z.string().max(80).optional(),
  band: z.enum(["ALL", "gold", "green", "amber", "red", "none"]).optional(),
  remote: z.enum(["ALL", "YES", "NO"]).optional(),
  sort: z.enum(["name", "percent", "createdAt", "lastLoginAt"]).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
});

const personFields = {
  name: z.string().trim().min(2, "Enter the full name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?[\d\s()-]{7,20})?$/, "Enter a valid phone number.")
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  city: optionalText(60),
  country: optionalText(60),
  isRemote: z.boolean().optional(),
  teamId: id.nullable().optional(),
};

export const addMemberBody = z.object({ ...personFields, role: z.enum(["MEMBER", "VOLUNTEER"]) });
export type AddMemberBody = z.infer<typeof addMemberBody>;

export const updateMemberBody = z
  .object(personFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Change at least one field.");
export type UpdateMemberBody = z.infer<typeof updateMemberBody>;

export const removeMemberBody = z.object({ reason: reason("removing them") });

export const statusBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suspend"), reason: reason("the suspension") }),
  z.object({ action: z.literal("reactivate") }),
  z.object({ action: z.literal("restore") }),
]);

export const approveBody = z.discriminatedUnion("approve", [
  z.object({ approve: z.literal(true) }),
  z.object({ approve: z.literal(false), reason: reason("declining") }),
]);

export const bulkApproveBody = z.object({ ids: z.array(id).min(1, "Choose at least one person.").max(200) });

export const bulkMembersBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assignTeam"), ids: z.array(id).min(1).max(500), teamId: id.nullable() }),
  z.object({ action: z.literal("suspend"), ids: z.array(id).min(1).max(500), reason: reason("the suspension") }),
]);

export const importBody = z.object({
  csv: z.string().min(1, "Choose a CSV file.").max(1_000_000, "The file is too large (1 MB at most)."),
  commit: z.boolean().default(false),
});

export const deletionDecisionBody = z.object({ confirm: z.boolean() });

export const noteBody = z.object({ body: z.string().trim().min(3, "Write a note (at least 3 characters).").max(1000) });

export const roleBody = z.object({
  role: z.enum(["MEMBER", "VOLUNTEER", "ADMIN"]),
  adminLevel: z.enum(["SUPER", "UNIT", "ATTENDANCE_OFFICER", "COMMS_OFFICER", "AUDITOR"]).nullable(),
  titles: z
    .array(z.enum(["TEAM_LEAD", "ZONE_CAPTAIN", "MARSHAL", "SUPPLIES_KEEPER", "WELCOME", "PRAYER_COORDINATOR"]))
    .max(6),
});

export const inviteBody = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  adminLevel: z.enum(["SUPER", "UNIT", "ATTENDANCE_OFFICER", "COMMS_OFFICER", "AUDITOR"]),
});

export const directMessageBody = z.object({
  userIds: z.array(id).min(1, "Choose at least one person.").max(500),
  subject: z.string().trim().min(3, "Add a subject.").max(120),
  body: z.string().trim().min(5, "Write the message (at least 5 characters).").max(5000),
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the 24-hour form, for example 22:00.");
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #1e40af.");

export const settingsBody = z
  .object({
    venue: z.object({
      name: z.string().trim().min(3).max(100),
      address: z.string().trim().min(5).max(200),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      radiusM: z
        .number()
        .int()
        .min(MIN_RADIUS_M, `At least ${MIN_RADIUS_M} m.`)
        .max(MAX_RADIUS_M, `At most ${MAX_RADIUS_M} m.`),
      verified: z.boolean(),
    }),
    maxAccuracyM: z.number().int().min(10, "At least 10 m.").max(200, "At most 200 m."),
    graceMinutes: z.number().int().min(0).max(30, "At most 30 minutes."),
    openBeforeMinutes: z.number().int().min(15, "At least 15 minutes.").max(180, "At most 3 hours."),
    closeAfterMinutes: z.number().int().min(30, "At least 30 minutes.").max(240, "At most 4 hours."),
    lateWeight: z.number().min(0.5, "Between 0.5 and 1.").max(1, "Between 0.5 and 1."),
    bandThresholds: z.object({
      gold: z.number().int().min(1).max(100),
      green: z.number().int().min(1).max(100),
      amber: z.number().int().min(1).max(100),
    }),
    atRiskPercent: z.number().int().min(1).max(99),
    atRiskConsecutiveAbsences: z.number().int().min(2).max(10),
    lowAttendancePercent: z.number().int().min(1).max(99),
    quietHours: z.object({ start: hhmm, end: hhmm }),
    locationRetentionMonths: z.number().int().min(1, "At least 1 month.").max(36, "At most 36 months."),
    timezone: z.string().refine(isValidZone, "Choose a valid time zone."),
    branding: z.object({
      primary: hex,
      accent: hex,
      logoUrl: z.string().regex(/^\/(images|api\/v1\/files)\/[\w./-]+$/, "Choose an uploaded logo."),
    }),
  })
  .superRefine((v, ctx) => {
    const t = v.bandThresholds;
    if (!(t.gold > t.green && t.green > t.amber))
      ctx.addIssue({
        code: "custom",
        path: ["bandThresholds", "green"],
        message: "Gold must be above Green, and Green above Amber.",
      });
  });
export type SettingsBody = z.infer<typeof settingsBody>;

export const auditQuery = z.object({
  q: z.string().max(100).optional(),
  actorId: z.string().max(80).optional(),
  action: z.string().max(60).optional(),
  entity: z.string().max(60).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  format: z.enum(["json", "csv"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(500).optional(),
});
