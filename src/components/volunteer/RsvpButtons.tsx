"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, HelpCircle, X } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Answer = "GOING" | "MAYBE" | "NO";
const OPTIONS: { value: Answer; label: string; icon: typeof Check }[] = [
  { value: "GOING", label: "Going", icon: Check },
  { value: "MAYBE", label: "Maybe", icon: HelpCircle },
  { value: "NO", label: "Can't make it", icon: X },
];

/** RSVP for an event (spec 7.3): Going, Maybe or Can't make it. */
export function RsvpButtons({ meetingId, title, initial }: { meetingId: string; title: string; initial?: Answer }) {
  const [answer, setAnswer] = React.useState<Answer | undefined>(initial);
  const [busy, setBusy] = React.useState(false);
  const choose = async (a: Answer) => {
    const prev = answer;
    setAnswer(a);
    setBusy(true);
    const r = await apiRequest(`/api/v1/meetings/${meetingId}/rsvp`, { body: { answer: a } });
    setBusy(false);
    if (!r.ok) {
      setAnswer(prev);
      toast.error(r.message);
    } else toast.success(`RSVP saved: ${OPTIONS.find((o) => o.value === a)!.label}`);
  };
  return (
    <div role="group" aria-label={`RSVP for ${title}`} className="flex flex-wrap gap-1.5">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={answer === value}
          disabled={busy}
          onClick={() => choose(value)}
          className={cn(
            "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-medium pointer-coarse:h-11",
            answer === value
              ? value === "GOING"
                ? "border-transparent bg-(--status-ontime-bg) text-(--status-ontime-fg)"
                : value === "MAYBE"
                  ? "border-transparent bg-(--status-late-bg) text-(--status-late-fg)"
                  : "border-transparent bg-muted text-foreground"
              : "border-border bg-surface text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon aria-hidden className="size-4" /> {label}
        </button>
      ))}
    </div>
  );
}
