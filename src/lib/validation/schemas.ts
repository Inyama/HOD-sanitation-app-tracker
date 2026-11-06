import { z } from "zod";

/** Zod schemas shared by forms and route handlers (spec 11: every body and query is validated). */

export const checkInBody = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100_000),
  deviceId: z.string().min(8).max(128),
  qrToken: z.string().max(64).optional(),
});
export type CheckInBody = z.infer<typeof checkInBody>;

export const excuseBody = z.object({
  meetingId: z.string().min(1),
  reason: z.string().trim().min(10, "Tell us a little more (at least 10 characters).").max(1000),
  proofUrl: z.string().url().optional(),
});

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  q: z.string().trim().max(120).optional(),
  sort: z.string().max(40).optional(),
});

export const isoInstant = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Expected an ISO date-time");

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128)
  .refine((s) => /[a-z]/i.test(s) && /\d/.test(s), "Mix letters and numbers.");
