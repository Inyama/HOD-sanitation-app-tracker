import type { EmailContent } from "./email-layout";
import { firstName } from "./templates";

/** Account emails (spec 8: approved, welcome, role change, reset, new device; plus verification and invites). */

export type AccountEmailKind =
  | "VERIFY_EMAIL"
  | "PASSWORD_RESET"
  | "NEW_DEVICE"
  | "ADMIN_INVITE"
  | "SIGNUP_RECEIVED"
  | "PASSWORD_CHANGED"
  | "ACCOUNT_APPROVED"
  | "SIGNUP_DECLINED"
  | "WELCOME_ADDED"
  | "ROLE_CHANGED";

export interface AccountEmailContext {
  name?: string;
  url?: string;
  when?: string;
  device?: string;
  level?: string;
  /** Role change: plain-language lines describing the change. */
  lines?: string[];
}

export function accountEmail(kind: AccountEmailKind, ctx: AccountEmailContext): EmailContent & { subject: string } {
  const hi = ctx.name ? `Hello ${firstName(ctx.name)},` : "Hello,";
  switch (kind) {
    case "VERIFY_EMAIL":
      return {
        subject: "Confirm your email for HOD Sanitation Hub",
        preheader: "One click to confirm your email address.",
        heading: "Confirm your email",
        paragraphs: [
          hi,
          "Thank you for signing up to serve with the Sanitation Unit. Please confirm your email address so a unit admin can review your request.",
        ],
        button: { label: "Confirm my email", url: ctx.url! },
        note: "This link expires in 48 hours. If you did not sign up, you can ignore this email.",
      };
    case "SIGNUP_RECEIVED":
      return {
        subject: "We received your request to join",
        preheader: "A unit admin will review your request.",
        heading: "Your request is with us",
        paragraphs: [
          hi,
          "Your email is confirmed. A unit admin will review your request, usually within two days, and we will email you as soon as you are approved.",
        ],
      };
    case "PASSWORD_RESET":
      return {
        subject: "Reset your HOD Sanitation Hub password",
        preheader: "Use this link to choose a new password.",
        heading: "Reset your password",
        paragraphs: [hi, "We received a request to reset your password. Choose a new one with the button below."],
        button: { label: "Choose a new password", url: ctx.url! },
        note: "This link expires in 1 hour and works once. If you did not ask for this, you can ignore this email; your password will not change.",
      };
    case "PASSWORD_CHANGED":
      return {
        subject: "Your password was changed",
        preheader: "Your HOD Sanitation Hub password was changed.",
        heading: "Password changed",
        paragraphs: [
          hi,
          `Your password was changed${ctx.when ? ` on ${ctx.when}` : ""}. If this was not you, contact a unit admin straight away.`,
        ],
      };
    case "NEW_DEVICE":
      return {
        subject: "New sign-in to your account",
        preheader: "We noticed a sign-in from a new device.",
        heading: "New sign-in",
        paragraphs: [
          hi,
          `Your account was signed in from a new device${ctx.device ? ` (${ctx.device})` : ""}${ctx.when ? ` on ${ctx.when}` : ""}.`,
          "If this was you, there is nothing to do. If not, reset your password now and tell a unit admin.",
        ],
        button: ctx.url ? { label: "Reset my password", url: ctx.url } : undefined,
      };
    case "ACCOUNT_APPROVED":
      return {
        subject: "Welcome to the Sanitation Unit: your account is approved",
        preheader: "You can now sign in and check in at meetings.",
        heading: "You are approved",
        paragraphs: [
          hi,
          "Good news: a unit admin has approved your account. You can now sign in, see the meeting schedule and check in when you arrive at the venue.",
          "Saturday Sanitation Meetings start at 9:30 am. Arrive before then to be marked On time.",
        ],
        button: { label: "Sign in", url: ctx.url! },
      };
    case "SIGNUP_DECLINED":
      return {
        subject: "About your request to join the Sanitation Unit",
        preheader: "Your request was not approved this time.",
        heading: "Your request to join",
        paragraphs: [
          hi,
          "Thank you for wanting to serve with the Sanitation Unit. Your request was not approved this time.",
          "If you think this is a mistake or would like to talk about it, reply to this email or speak to a unit leader on Saturday.",
        ],
      };
    case "WELCOME_ADDED":
      return {
        subject: "You have been added to HOD Sanitation Hub",
        preheader: "Choose a password to start using your account.",
        heading: "Welcome to the Sanitation Unit",
        paragraphs: [
          hi,
          "A unit admin has created an account for you on HOD Sanitation Hub, where the unit keeps attendance, reminders and duty rosters.",
          "Choose a password to sign in. After that you can check in at meetings from your phone.",
        ],
        button: { label: "Choose my password", url: ctx.url! },
        note: "This link expires in 7 days and works once. If you were not expecting this, you can ignore this email.",
      };
    case "ROLE_CHANGED":
      return {
        subject: "Your role in the Sanitation Unit has changed",
        preheader: "A unit admin updated your role or titles.",
        heading: "Your role has changed",
        paragraphs: [hi, "A unit admin has updated your role in HOD Sanitation Hub.", ...(ctx.lines ?? [])],
        button: ctx.url ? { label: "Open the app", url: ctx.url } : undefined,
      };
    case "ADMIN_INVITE":
      return {
        subject: "You are invited to administer HOD Sanitation Hub",
        preheader: "Accept your invitation and set up two-factor sign-in.",
        heading: "You have been invited",
        paragraphs: [
          hi,
          `You have been invited to join HOD Sanitation Hub as ${ctx.level ?? "an admin"}. Accept the invitation to set your password and turn on two-factor sign-in.`,
        ],
        button: { label: "Accept invitation", url: ctx.url! },
        note: "This invitation expires in 7 days and can be used once.",
      };
  }
}
