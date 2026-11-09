"use client";

import * as React from "react";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/form-field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import type { AuditLog } from "@/lib/repo/types";
import { actionLabel, describeChange, filterAudit, type AuditFilters } from "@/lib/admin/audit";

interface AuditLogViewProps {
  rows: AuditLog[];
  /** [id, name] pairs for people, meetings and teams. */
  names: [string, string][];
  /** Lagos time label per entry id, worked out on the server. */
  when: Record<string, string>;
  today: string;
}

/** Audit log (spec 7.4 item 16): who, what, when, from where; filters; CSV export with the same filters. */
export function AuditLogView({ rows, names: nameList, when, today }: AuditLogViewProps) {
  const names = React.useMemo(() => new Map(nameList), [nameList]);
  const [f, setF] = React.useState<AuditFilters>({});
  const set = (k: keyof AuditFilters, v: string) => setF((s) => ({ ...s, [k]: v || undefined }));
  const visible = React.useMemo(() => filterAudit(rows, f, names), [rows, f, names]);

  const actors = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))]
    .map((id) => [id, names.get(id) ?? id] as const)
    .sort((a, b) => a[1].localeCompare(b[1]));
  const actions = [...new Set(rows.map((r) => r.action))].sort((a, b) => actionLabel(a).localeCompare(actionLabel(b)));
  const entities = [...new Set(rows.map((r) => r.entity))].sort();

  const exportHref = `/api/v1/admin/audit?${new URLSearchParams(
    Object.entries({ ...f, format: "csv" }).filter(([, v]) => !!v) as [string, string][],
  ).toString()}`;

  const columns: Column<AuditLog>[] = [
    {
      key: "when",
      header: "When",
      primary: true,
      sortValue: (r) => r.createdAt,
      className: "whitespace-nowrap",
      cell: (r) => <span className="text-sm">{when[r.id]}</span>,
    },
    {
      key: "who",
      header: "Who",
      sortValue: (r) => (r.actorId ? (names.get(r.actorId) ?? "") : "System"),
      cell: (r) => <span className="font-medium">{r.actorId ? (names.get(r.actorId) ?? "Unknown") : "System"}</span>,
    },
    {
      key: "what",
      header: "What",
      sortValue: (r) => actionLabel(r.action),
      cell: (r) => {
        const changes = describeChange(r.before, r.after);
        const target = r.entityId ? names.get(r.entityId) : null;
        return (
          <div className="min-w-0 space-y-1">
            <p>
              {actionLabel(r.action)}
              {target && <span className="text-muted-foreground">: {target}</span>}
            </p>
            {changes.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer font-medium text-role-strong">Before and after</summary>
                <dl className="mt-1 space-y-0.5">
                  {changes.map((c) => (
                    <div key={c.field} className="flex flex-wrap gap-x-1.5">
                      <dt className="font-semibold">{c.field}:</dt>
                      <dd>
                        <span className="text-muted-foreground line-through decoration-1">{c.before}</span>{" "}
                        <span aria-hidden>→</span>
                        <span className="sr-only">changed to</span> {c.after}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
          </div>
        );
      },
    },
    {
      key: "entity",
      header: "Record",
      sortValue: (r) => r.entity,
      cell: (r) => <span className="text-xs text-muted-foreground">{r.entity}</span>,
    },
    {
      key: "ip",
      header: "From",
      cell: (r) => <span className="tabular text-xs text-muted-foreground">{r.ip ?? "–"}</span>,
    },
  ];

  const field = (id: string, label: string, control: React.ReactNode, className = "") => (
    <div className={`min-w-0 space-y-1 ${className}`}>
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {control}
    </div>
  );

  return (
    <div className="space-y-4">
      <section
        aria-label="Filters"
        className="grid grid-cols-2 gap-3 rounded-(--radius-lg) border border-border bg-card p-4 shadow-soft md:grid-cols-3 xl:grid-cols-6"
      >
        {field(
          "a-q",
          "Search",
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="a-q"
              type="search"
              className="pl-9"
              value={f.q ?? ""}
              onChange={(e) => set("q", e.target.value)}
              placeholder="Name, action, IP"
            />
          </div>,
          "col-span-2 md:col-span-3 xl:col-span-1",
        )}
        {field(
          "a-actor",
          "Who",
          <NativeSelect id="a-actor" value={f.actorId ?? ""} onChange={(e) => set("actorId", e.target.value)}>
            <option value="">Everyone</option>
            {actors.map(([id, n]) => (
              <option key={id} value={id}>
                {n}
              </option>
            ))}
          </NativeSelect>,
        )}
        {field(
          "a-action",
          "What",
          <NativeSelect id="a-action" value={f.action ?? ""} onChange={(e) => set("action", e.target.value)}>
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {actionLabel(a)}
              </option>
            ))}
          </NativeSelect>,
        )}
        {field(
          "a-entity",
          "Record",
          <NativeSelect id="a-entity" value={f.entity ?? ""} onChange={(e) => set("entity", e.target.value)}>
            <option value="">All records</option>
            {entities.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </NativeSelect>,
        )}
        {field(
          "a-from",
          "From",
          <Input
            id="a-from"
            type="date"
            max={today}
            value={f.from ?? ""}
            onChange={(e) => set("from", e.target.value)}
          />,
        )}
        {field(
          "a-to",
          "To",
          <Input id="a-to" type="date" max={today} value={f.to ?? ""} onChange={(e) => set("to", e.target.value)} />,
        )}
      </section>

      <DataTable
        caption="Audit log"
        columns={columns}
        rows={visible}
        getRowId={(r) => r.id}
        initialSort={{ key: "when", dir: "desc" }}
        maxHeight={680}
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              <span className="font-semibold text-foreground">{visible.length}</span> of {rows.length} entries
            </p>
            <Button asChild variant="outline" size="sm">
              <a href={exportHref} download>
                <Download aria-hidden /> Export CSV
              </a>
            </Button>
          </div>
        }
        empty={
          <EmptyState
            illustration="search"
            title="No entries match"
            description="Try a wider date range or clear a filter."
          />
        }
      />
      <p className="text-xs text-muted-foreground">
        The audit log is append-only: entries cannot be edited or deleted. Exports are recorded here too.
      </p>
    </div>
  );
}
