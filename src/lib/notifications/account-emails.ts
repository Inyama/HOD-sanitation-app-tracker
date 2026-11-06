import type { EmailContent } from "./email-layout";
import { firstName } from "./templates";

/** Account emails (spec 8: approved, welcome, role change, reset, new device; plus verification and invites). */

export type AccountEmailKind =
  "VERIFY_EMAIL" | "PASSWORD_RESET" | "NEW_DEVICE" | "ADMIN_INVITE" | "SIGNUP_RECEIVED" | "PASSWORD_CHANGED";

export interface AccountEmailContext {
  name?: string;
  url?: string;
  when?: string;
  device?: string;
  level?: string;
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
