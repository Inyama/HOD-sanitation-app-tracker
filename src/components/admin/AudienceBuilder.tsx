"use client";

import * as React from "react";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/form-field";
import type { AudienceSpec } from "@/lib/repo/types";
import { resolveAudience, type AudiencePerson } from "@/lib/notifications/audience";
import { cn } from "@/lib/utils";

export interface AudienceOption extends AudiencePerson {
  name: string;
  bandLabel: string;
  percent: number | null;
}

type Kind = AudienceSpec["kind"];

const KINDS: { kind: Kind; label: string }[] = [
  { kind: "EVERYONE", label: "Everyone" },
  { kind: "ALL_MEMBERS", label: "All members" },
  { kind: "ALL_VOLUNTEERS", label: "All volunteers" },
  { kind: "TEAM", label: "A team" },
  { kind: "BAND", label: "A percentage band" },
  { kind: "ABSENT_LAST_SATURDAY", label: "Absent last Saturday" },
  { kind: "HAND_PICKED", label: "Hand-picked" },
];

const BANDS = [
  { key: "gold", label: "Gold standard (90% and above)" },
  { key: "green", label: "Strong (75 to 89%)" },
  { key: "amber", label: "Needs attention (50 to 74%)" },
  { key: "red", label: "At risk (below 50%)" },
] as const;

/**
 * Audience builder (spec 7.4 item 10): who a message goes to, with a live count worked out by
 * the same resolveAudience function the server uses when it sends.
 */
export function AudienceBuilder({
  people,
  teams,
  value,
  onChange,
}: {
  people: AudienceOption[];
  teams: { id: string; name: string }[];
  value: AudienceSpec;
  onChange: (spec: AudienceSpec) => void;
}) {
  const [q, setQ] = React.useState("");
  const ids = React.useMemo(() => resolveAudience(value, people), [value, people]);
  const chosen = people.filter((p) => ids.includes(p.id));
  const picked = new Set(value.kind === "HAND_PICKED" ? value.userIds : []);

  const setKind = (kind: Kind) => {
    if (kind === "TEAM") onChange({ kind, teamId: teams[0]?.id ?? "" });
    else if (kind === "BAND") onChange({ kind, band: "amber" });
    else if (kind === "HAND_PICKED") onChange({ kind, userIds: [] });
    else onChange({ kind } as AudienceSpec);
  };
  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ kind: "HAND_PICKED", userIds: [...next] });
  };
  const needle = q.trim().toLowerCase();

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">Audience</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Who receives the message">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            role="radio"
            aria-checked={value.kind === k.kind}
            onClick={() => setKind(k.kind)}
            className={cn(
              "min-h-10 rounded-full border px-3.5 text-sm font-medium",
              value.kind === k.kind ? "border-role bg-role-soft text-role-strong" : "border-border hover:bg-muted",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      {value.kind === "TEAM" && (
        <label className="block max-w-sm space-y-1.5 text-sm font-medium">
          Team
          <NativeSelect value={value.teamId} onChange={(e) => onChange({ kind: "TEAM", teamId: e.target.value })}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        </label>
      )}
      {value.kind === "BAND" && (
        <label className="block max-w-sm space-y-1.5 text-sm font-medium">
          Band
          <NativeSelect
            value={value.band}
            onChange={(e) => onChange({ kind: "BAND", band: e.target.value as (typeof BANDS)[number]["key"] })}
          >
            {BANDS.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </NativeSelect>
        </label>
      )}
      {value.kind === "HAND_PICKED" && (
        <div className="space-y-2">
          <div className="relative max-w-sm">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search people"
              aria-label="Search people to add"
              className="pl-9"
            />
          </div>
          <ul
            className="grid max-h-56 gap-1 overflow-auto rounded-(--radius-md) border border-border p-2 sm:grid-cols-2"
            aria-label="People"
          >
            {people
              .filter((p) => !needle || p.name.toLowerCase().includes(needle))
              .map((p) => (
                <li key={p.id}>
                  <label className="flex min-h-10 items-center gap-2 rounded px-2 text-sm hover:bg-muted/60">
                    <Checkbox checked={picked.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.role === "VOLUNTEER" ? "Volunteer" : p.role === "ADMIN" ? "Admin" : "Member"}
                    </span>
                  </label>
                </li>
              ))}
          </ul>
        </div>
      )}

      <p
        className="rounded-(--radius-md) bg-muted/50 px-3 py-2 text-sm break-words"
        aria-live="polite"
        data-testid="audience-count"
      >
        <Users aria-hidden className="mr-2 inline size-4 align-[-2px] text-role-strong" />
        <strong className="tabular">{ids.length}</strong> {ids.length === 1 ? "person" : "people"} will receive this
        {chosen.length > 0 && (
          <span className="text-muted-foreground">
            :{" "}
            {chosen
              .slice(0, 5)
              .map((p) => p.name)
              .join(", ")}
            {chosen.length > 5 ? ` and ${chosen.length - 5} more` : ""}
          </span>
        )}
      </p>
    </fieldset>
  );
}
