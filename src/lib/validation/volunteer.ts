import { z } from "zod";

/** Volunteer request schemas (spec 11). */

export const dutySignUp = z.object({ meetingId: z.string().min(3).max(80), zoneId: z.string().min(3).max(80) });
export const swapDecision = z.object({ approve: z.boolean() });

export const manualHours = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
  hours: z.number().min(0.5, "At least half an hour.").max(12, "At most 12 hours in one entry."),
  note: z.string().trim().min(5, "Say briefly what you did (at least 5 characters).").max(300),
});

export const issueReport = z.object({
  area: z.enum(["Sanctuary", "Restrooms", "Entrance", "Kitchen", "Outdoors", "Other"]),
  urgency: z.enum(["LOW", "MEDIUM", "URGENT"]),
  note: z.string().trim().min(10, "Describe the problem (at least 10 characters).").max(1000),
  photoUrl: z
    .string()
    .regex(/^\/api\/v1\/files\/[A-Za-z0-9_-]+$/)
    .nullable()
    .optional(),
});

export const manualCheckInBody = z.object({
  userId: z.string().min(3).max(80),
  note: z.string().trim().min(3, "Add a short reason, for example: phone battery flat.").max(200),
});

export const encourageBody = z.object({ userId: z.string().min(3).max(80) });
