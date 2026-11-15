"use client";

import * as React from "react";
import { renderEmailHtml, type EmailContent } from "@/lib/notifications/email-layout";

/**
 * Branded email preview (spec 8): the exact HTML the sender would use, in a sandboxed frame
 * (no scripts), with the subject line above it.
 */
export function EmailPreview({
  subject,
  content,
  className,
}: {
  subject: string;
  content: EmailContent;
  className?: string;
}) {
  const html = React.useMemo(() => renderEmailHtml(content, { appUrl: "" }), [content]);
  return (
    <figure className={className}>
      <figcaption className="mb-2 rounded-(--radius-sm) border border-border bg-muted/50 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Subject: </span>
        <span className="font-semibold">{subject}</span>
      </figcaption>
      <iframe
        title={`Email preview: ${subject}`}
        sandbox=""
        srcDoc={html}
        className="h-[28rem] w-full rounded-(--radius-md) border border-border bg-white"
      />
    </figure>
  );
}
