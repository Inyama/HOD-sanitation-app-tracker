/**
 * Light rich text for messages (spec 7.4 item 10): **bold**, *italic*, "- " bullet lists,
 * [links](https://...) and paragraphs. Parsed into blocks, never run as HTML, so pasted text
 * cannot inject markup. The same blocks render in the inbox, the email and the preview.
 */

export interface Span {
  text: string;
  bold?: boolean;
  italic?: boolean;
  href?: string;
}

export type Block = { kind: "p"; spans: Span[] } | { kind: "ul"; items: Span[][] };

const SAFE_URL = /^(https?:\/\/|mailto:|\/)[^\s<>"']*$/i;

export function parseInline(text: string): Span[] {
  const out: Span[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ text: m[1], bold: true });
    else if (m[2] !== undefined) out.push({ text: m[2], italic: true });
    else if (SAFE_URL.test(m[4])) out.push({ text: m[3], href: m[4] });
    else out.push({ text: m[0] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export function parseRichText(text: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of text.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const lines = chunk.split("\n").filter((l) => l.trim() !== "");
    if (!lines.length) continue;
    if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
      blocks.push({ kind: "ul", items: lines.map((l) => parseInline(l.replace(/^\s*[-*•]\s+/, ""))) });
    } else {
      blocks.push({ kind: "p", spans: parseInline(lines.join("\n")) });
    }
  }
  return blocks;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function spanHtml(s: Span): string {
  let h = esc(s.text).replace(/\n/g, "<br>");
  if (s.bold) h = `<strong>${h}</strong>`;
  if (s.italic) h = `<em>${h}</em>`;
  if (s.href) h = `<a href="${esc(s.href)}" style="color:#1e40af">${h}</a>`;
  return h;
}

/** Escaped HTML for the email body (inline styles only). */
export function richTextToHtml(text: string, font: string): string {
  return parseRichText(text)
    .map((b) =>
      b.kind === "p"
        ? `<tr><td style="font-family:${font};font-size:15px;line-height:1.6;color:#0f172a;padding-bottom:12px">${b.spans.map(spanHtml).join("")}</td></tr>`
        : `<tr><td style="font-family:${font};font-size:15px;line-height:1.6;color:#0f172a;padding-bottom:12px"><ul style="margin:0;padding-left:20px">${b.items.map((i) => `<li>${i.map(spanHtml).join("")}</li>`).join("")}</ul></td></tr>`,
    )
    .join("\n");
}

/** Plain text (notification previews, the text part of emails). */
export function richTextToPlain(text: string): string {
  return parseRichText(text)
    .map((b) =>
      b.kind === "p"
        ? b.spans.map((s) => (s.href && !s.href.startsWith("/") ? `${s.text} (${s.href})` : s.text)).join("")
        : b.items.map((i) => `• ${i.map((s) => s.text).join("")}`).join("\n"),
    )
    .join("\n\n");
}
