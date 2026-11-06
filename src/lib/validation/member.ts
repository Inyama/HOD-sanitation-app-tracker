import { z } from "zod";
import { newPassword } from "./auth";

/** Member-area request schemas (spec 11). */

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the 24-hour format, for example 22:00.");

export const profilePatch = z.object({
  name: z.string().trim().min(3).max(100).optional(),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(25)
    .regex(/^[+()\d\s-]+$/, "Use digits, spaces and an optional leading +.")
    .optional(),
  city: z.string().trim().min(2).max(60).optional(),
  country: z.string().trim().min(2).max(60).optional(),
  timezone: z
    .string()
    .max(64)
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-GB", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Choose a valid time zone.")
    .optional(),
  language: z.enum(["en"]).optional(),
  avatarUrl: z
    .string()
    .regex(/^\/api\/v1\/files\/[A-Za-z0-9_-]+$/)
    .nullable()
    .optional(),
});

export const preferencesPatch = z.object({
  email: z.boolean().optional(),
  push: z.boolean().optional(),
  weeklySummary: z.boolean().optional(),
  nudges: z.boolean().optional(),
  quietHours: z.object({ start: hm, end: hm }).nullable().optional(),
});

export const passwordChange = z.object({
  current: z.string().min(1, "Enter your current password.").max(128),
  next: newPassword,
});

export const excuseCreate = z.object({
  meetingId: z.string().min(3).max(80),
  reason: z.string().trim().min(10, "Tell us a little more (at least 10 characters).").max(1000),
  proofUrl: z
    .string()
    .regex(/^\/api\/v1\/files\/[A-Za-z0-9_-]+$/)
    .nullable()
    .optional(),
});

export const fileUpload = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(["image/png", "image/jpeg", "image/webp", "application/pdf"]),
  /** Base64 data, no data: prefix. */
  data: z.string().min(4).max(3_000_000),
  purpose: z.enum(["excuse-proof", "avatar", "issue-photo"]),
});

export const rsvpBody = z.object({ answer: z.enum(["GOING", "MAYBE", "NO"]) });
