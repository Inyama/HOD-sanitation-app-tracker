import { z } from "zod";
import { MIN_PASSWORD_LENGTH, passwordStrength } from "@/lib/auth/strength";

/** Auth schemas, shared by the forms (React Hook Form) and the route handlers. */

const email = z.string().trim().toLowerCase().email("Enter a valid email address, like name@example.com.").max(254);

export const newPassword = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(128, "Use 128 characters or fewer.")
  .refine(
    (pw) => passwordStrength(pw).score >= 2,
    "This password is too easy to guess. Mix letters, numbers and symbols.",
  );

export const loginTabs = ["member", "volunteer", "admin"] as const;
export type LoginTab = (typeof loginTabs)[number];

export const loginBody = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(128),
  tab: z.enum(loginTabs).default("member"),
  remember: z.boolean().default(false),
  next: z.string().max(300).optional(),
});
export type LoginBody = z.infer<typeof loginBody>;

export const twoFactorBody = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the six-digit code from your authenticator app."),
});

export const COUNTRIES = [
  "Nigeria",
  "Ghana",
  "United Kingdom",
  "United States",
  "Canada",
  "South Africa",
  "Kenya",
  "Ireland",
  "Germany",
  "United Arab Emirates",
  "Other",
] as const;

export const LANGUAGES = [
  { value: "en", label: "English", available: true },
  { value: "fr", label: "French (coming soon)", available: false },
  { value: "es", label: "Spanish (coming soon)", available: false },
  { value: "yo", label: "Yoruba (coming soon)", available: false },
] as const;

export const AVAILABILITY = ["Saturday mornings", "Thursday evenings", "Special events", "Weekday errands"] as const;

export const signupBody = z.object({
  role: z.enum(["MEMBER", "VOLUNTEER"]),
  name: z
    .string()
    .trim()
    .min(3, "Enter your full name.")
    .max(100)
    .refine((s) => s.split(/\s+/).length >= 2, "Enter your first and last name."),
  email,
  phone: z
    .string()
    .trim()
    .min(7, "Enter a phone number we can reach you on.")
    .max(25)
    .regex(/^[+()\d\s-]+$/, "Use digits, spaces and an optional leading +."),
  password: newPassword,
  country: z.string().trim().min(2, "Choose your country.").max(60),
  city: z.string().trim().min(2, "Enter your city.").max(60),
  language: z.enum(["en", "fr", "es", "yo"]).default("en"),
  unitCode: z.string().trim().max(20).optional().or(z.literal("")),
  consentLocation: z.literal(true, {
    message: "Please agree to location use at check-in. It is how Saturday attendance is recorded.",
  }),
  consentReminders: z.literal(true, { message: "Please agree to receive meeting reminders." }),
  zones: z.array(z.string().max(40)).max(5).optional(),
  availability: z.array(z.string().max(40)).max(4).optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type SignupBody = z.infer<typeof signupBody>;

export const forgotBody = z.object({ email });

export const resetBody = z.object({
  token: z.string().min(10).max(2048),
  password: newPassword,
});

export const verifyEmailBody = z.union([
  z.object({ token: z.string().min(10).max(2048) }),
  z.object({ resendFor: email }),
]);

export const acceptInviteBody = z.object({
  token: z.string().min(8).max(200),
  name: z.string().trim().min(3, "Enter your full name.").max(100),
  password: newPassword,
  secret: z.string().regex(/^[A-Z2-7]{16,64}$/),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the six-digit code from your authenticator app."),
});
