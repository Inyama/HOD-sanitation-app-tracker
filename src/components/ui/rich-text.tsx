import * as React from "react";
import { parseRichText, type Span } from "@/lib/notifications/richtext";
import { cn } from "@/lib/utils";

function SpanView({ s }: { s: Span }) {
  let node: React.ReactNode = s.text;
  if (s.bold) node = <strong>{node}</strong>;
  if (s.italic) node = <em>{node}</em>;
  if (s.href)
    node = s.href.startsWith("/") ? (
      <a href={s.href} className="font-medium text-role-strong underline underline-offset-4">
        {node}
      </a>
    ) : (
      <a
        href={s.href}
        target="_blank"
        rel="noreferrer noopener"
        className="font-medium text-role-strong underline underline-offset-4"
      >
        {node}
      </a>
    );
  return <>{node}</>;
}

/** Message body with the light formatting (bold, italic, bullets, links). Never renders raw HTML. */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("space-y-3 leading-relaxed", className)}>
      {parseRichText(text).map((b, i) =>
        b.kind === "p" ? (
          <p key={i} className="whitespace-pre-line">
            {b.spans.map((s, j) => (
              <SpanView key={j} s={s} />
            ))}
          </p>
        ) : (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.items.map((item, j) => (
              <li key={j}>
                {item.map((s, k) => (
                  <SpanView key={k} s={s} />
                ))}
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
