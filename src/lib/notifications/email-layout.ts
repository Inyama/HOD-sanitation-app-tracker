/**
 * Branded HTML email layout (spec 8): navy header with the logo on a white pill, body in
 * Plus Jakarta Sans (with safe fallbacks), gold button, footer with address and settings link.
 * Inline styles only, because email clients ignore stylesheets.
 */

export interface EmailContent {
  preheader: string;
  heading: string;
  paragraphs: string[];
  /** Already-escaped body rows (rich-text messages); used instead of `paragraphs` in the HTML part. */
  bodyHtml?: string;
  button?: { label: string; url: string };
  /** Small print under the button, e.g. "This link expires in 1 hour." */
  note?: string;
}

export interface EmailLayoutOptions {
  appUrl: string;
  venueAddress?: string;
}

export const EMAIL_FONT = "'Plus Jakarta Sans', 'Segoe UI', Helvetica, Arial, sans-serif";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function renderEmailHtml(c: EmailContent, o: EmailLayoutOptions): string {
  const address = o.venueAddress ?? "7 Surulere Industrial Road, Off Adeniyi Jones, Ikeja, Lagos, Nigeria";
  const font = EMAIL_FONT;
  const button = c.button
    ? `<tr><td style="padding:8px 0 4px"><a href="${esc(c.button.url)}" style="display:inline-block;background:#d4a437;background-image:linear-gradient(135deg,#f5d27a,#d4a437);color:#0a1a44;font-weight:700;text-decoration:none;padding:14px 26px;border-radius:999px;font-family:${font};font-size:15px">${esc(c.button.label)}</a></td></tr>`
    : "";
  const note = c.note
    ? `<tr><td style="padding:12px 0 0;color:#475569;font-size:13px;font-family:${font}">${esc(c.note)}</td></tr>`
    : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.heading)}</title></head>
<body style="margin:0;background:#f8fafc;padding:24px 12px">
<span style="display:none;max-height:0;overflow:hidden">${esc(c.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 30px rgba(10,26,68,.10)">
<tr><td style="background:#0a1a44;background-image:linear-gradient(135deg,#0a1a44,#1e3a8a 55%,#2563eb);padding:22px 28px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="background:#ffffff;border-radius:999px;padding:6px 14px 6px 8px"><img src="${esc(o.appUrl)}/images/HOD-logo.webp" width="34" height="31" alt="Household of David" style="vertical-align:middle;border:0"><span style="font-family:${font};font-weight:700;color:#0a1a44;font-size:14px;vertical-align:middle;padding-left:8px">HOD Sanitation Hub</span></td>
</tr></table></td></tr>
<tr><td style="padding:28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:#0f172a;padding-bottom:12px">${esc(c.heading)}</td></tr>
${c.bodyHtml ?? c.paragraphs.map((p) => `<tr><td style="font-family:${font};font-size:15px;line-height:1.6;color:#0f172a;padding-bottom:12px">${esc(p)}</td></tr>`).join("\n")}
${button}
${note}
</table></td></tr>
<tr><td style="padding:18px 28px;background:#f1f5f9;font-family:${font};font-size:12px;line-height:1.5;color:#475569">
Household of David · Sanitation Unit<br>${esc(address)}<br>
<a href="${esc(o.appUrl)}/member/settings" style="color:#1e40af">Notification settings</a> · <a href="${esc(o.appUrl)}/privacy" style="color:#1e40af">Privacy</a>
</td></tr></table></body></html>`;
}

export function renderEmailText(c: EmailContent): string {
  return [
    c.heading,
    "",
    ...c.paragraphs,
    ...(c.button ? ["", `${c.button.label}: ${c.button.url}`] : []),
    ...(c.note ? ["", c.note] : []),
  ].join("\n");
}
