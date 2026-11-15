import "server-only";
import { renderEmailHtml, renderEmailText, type EmailContent } from "../email-layout";
import { authStore } from "@/lib/auth/store";

/** Email sending behind an interface (spec 1, 8). Phase 8 adds the Resend sender. */

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** For the delivery log and the demo outbox. */
  kind: string;
}

export interface SentEmail extends OutgoingEmail {
  id: string;
  sentAt: string;
  provider: string;
}

export interface EmailSender {
  readonly name: string;
  send(email: OutgoingEmail): Promise<SentEmail>;
}

/**
 * Development sender: prints a one-line summary (no personal data beyond the recipient's domain)
 * and keeps the full message in the in-memory demo outbox at /dev/outbox.
 */
export class ConsoleEmailSender implements EmailSender {
  readonly name = "console";
  async send(email: OutgoingEmail): Promise<SentEmail> {
    const sent: SentEmail = {
      ...email,
      id: `eml-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      sentAt: new Date().toISOString(),
      provider: this.name,
    };
    authStore().outbox.unshift(sent);
    authStore().outbox.splice(200);
    console.info(`[email:${this.name}] ${email.kind} to *@${email.to.split("@")[1] ?? "?"}: ${email.subject}`);
    return sent;
  }
}

let sender: EmailSender | null = null;

export function getEmailSender(): EmailSender {
  if (!sender) sender = new ConsoleEmailSender();
  return sender;
}

export function appUrl(): string {
  // NEXT_PUBLIC_APP_URL wins; on Netlify, URL is the site's address.
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function sendBrandedEmail(
  to: string,
  kind: string,
  content: EmailContent & { subject: string },
): Promise<SentEmail> {
  return getEmailSender().send({
    to,
    kind,
    subject: content.subject,
    html: renderEmailHtml(content, { appUrl: appUrl() }),
    text: renderEmailText(content),
  });
}
