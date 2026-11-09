"use client";

import * as React from "react";
import Link from "next/link";
import { MessageSquare, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { MessageDialog } from "./MessageDialog";

export interface AtRiskPerson {
  id: string;
  name: string;
  percent: number | null;
  reason: string;
}

/** At-risk list (spec 7.4): below the threshold or absent several times in a row, with a Message button. */
export function AtRiskList({ people, canMessage }: { people: AtRiskPerson[]; canMessage: boolean }) {
  const [target, setTarget] = React.useState<AtRiskPerson[] | null>(null);
  if (people.length === 0)
    return (
      <EmptyState illustration="calendar" title="Nobody is at risk" description="Everyone is above the threshold." />
    );
  return (
    <>
      {canMessage && people.length > 1 && (
        <Button variant="outline" size="sm" className="mb-3" onClick={() => setTarget(people)}>
          <MessageSquare aria-hidden /> Message all {people.length}
        </Button>
      )}
      <ul className="max-h-[22rem] divide-y divide-border overflow-auto" tabIndex={0} aria-label="At-risk people">
        {people.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <UserAvatar name={p.name} size={34} />
            <div className="min-w-0 flex-1 basis-32">
              <Link href={`/admin/members/${p.id}`} className="block truncate text-sm font-semibold hover:underline">
                {p.name}
              </Link>
              <p className="flex items-center gap-1.5 text-xs text-(--status-absent-fg)">
                <TriangleAlert aria-hidden className="size-3.5" />
                <span className="tabular">{p.percent === null ? "–" : `${p.percent}%`}</span> · {p.reason}
              </p>
            </div>
            {canMessage && (
              <Button variant="outline" size="sm" onClick={() => setTarget([p])}>
                <MessageSquare aria-hidden /> Message<span className="sr-only"> {p.name}</span>
              </Button>
            )}
          </li>
        ))}
      </ul>
      <MessageDialog
        people={target ?? []}
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        defaultSubject="We miss you at the Sanitation Unit"
        defaultBody={
          "Hello {first_name}, we have missed you at our recent meetings and wanted to check that all is well.\n\nIf something is making it hard to come, reply to this message or talk to your Team Lead. We would love to see you on Saturday."
        }
      />
    </>
  );
}
