"use client";

import * as React from "react";
import { toast } from "sonner";
import { CircleCheck, Download, FileUp, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiRequest } from "@/lib/api-client";
import type { ImportPreview } from "@/lib/admin/members";

const MAX_BYTES = 1_000_000;

/** Import CSV with preview and error report (spec 7.4 members). Valid rows can be imported while errors are fixed. */
export function ImportMembersSheet({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const [csv, setCsv] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const reset = () => {
    setCsv(null);
    setFileName(null);
    setPreview(null);
    setError(null);
  };

  const choose = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    reset();
    if (!file.name.toLowerCase().endsWith(".csv")) return setError("Choose a CSV file (.csv).");
    if (file.size > MAX_BYTES) return setError("The file is too large (1 MB at most).");
    const text = await file.text();
    setFileName(file.name);
    setCsv(text);
    setBusy(true);
    const r = await apiRequest<ImportPreview>("/api/v1/admin/members/import", { body: { csv: text, commit: false } });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setPreview(r);
  };

  const commit = async () => {
    if (!csv) return;
    setBusy(true);
    const r = await apiRequest<{ created: number }>("/api/v1/admin/members/import", { body: { csv, commit: true } });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    toast.success(`${r.created} ${r.created === 1 ? "person" : "people"} imported`, {
      description: "Each one gets an email to choose a password.",
    });
    onOpenChange(false);
    reset();
    onImported();
  };

  const linesWithErrors = preview ? new Set(preview.errors.map((e) => e.line)).size : 0;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-heading text-xl">Import members from CSV</SheetTitle>
          <SheetDescription>
            Columns: name and email (required), phone, role (member or volunteer), team, city, country, remote (yes or
            no). Nothing is saved until you confirm.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="/files/member-import-template.csv" download>
                <Download aria-hidden /> Template
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/files/member-import-sample.csv" download>
                <Download aria-hidden /> Sample with mistakes
              </a>
            </Button>
          </div>

          <label
            htmlFor="import-file"
            className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-(--radius-lg) border-2 border-dashed border-border p-4 text-center hover:bg-muted/50"
          >
            <FileUp aria-hidden className="size-6 text-role-strong" />
            <span className="text-sm font-semibold">{fileName ?? "Choose a CSV file"}</span>
            <span className="text-xs text-muted-foreground">Up to 500 people and 1 MB</span>
          </label>
          <input id="import-file" type="file" accept=".csv,text/csv" className="sr-only" onChange={choose} />

          {busy && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 aria-hidden className="size-4 animate-spin" /> Checking the file…
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-(--status-absent-fg)">
              {error}
            </p>
          )}

          {preview && (
            <section aria-label="Import preview" className="space-y-4">
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  ["Rows read", preview.total],
                  ["Ready", preview.rows.length],
                  ["Need fixing", linesWithErrors],
                ].map(([k, n]) => (
                  <div key={k} className="rounded-(--radius-md) border border-border p-2">
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="tabular font-heading text-2xl font-semibold">{n}</dd>
                  </div>
                ))}
              </dl>

              {preview.errors.length > 0 && (
                <div className="rounded-(--radius-md) border border-(--status-absent)/40 bg-(--status-absent-bg) p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-(--status-absent-fg)">
                    <TriangleAlert aria-hidden className="size-4" /> Error report: these rows will be skipped
                  </p>
                  <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-sm" tabIndex={0} aria-label="Import errors">
                    {preview.errors.map((e, i) => (
                      <li key={i}>
                        <span className="font-semibold">Line {e.line}</span> ({e.field}): {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.rows.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <CircleCheck aria-hidden className="size-4 text-(--status-ontime-fg)" /> Ready to import
                  </p>
                  <ul
                    className="max-h-56 divide-y divide-border overflow-auto rounded-(--radius-md) border border-border text-sm"
                    tabIndex={0}
                    aria-label="Rows ready to import"
                  >
                    {preview.rows.map((r) => (
                      <li key={r.line} className="px-3 py-2">
                        <span className="font-medium">{r.name}</span>{" "}
                        <span className="text-muted-foreground">
                          · {r.email} · {r.role === "VOLUNTEER" ? "Volunteer" : "Member"}
                          {r.teamName ? ` · ${r.teamName}` : ""}
                          {r.isRemote ? " · Remote" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Button variant="role" className="w-full" disabled={busy || preview.rows.length === 0} onClick={commit}>
                {busy && <Loader2 aria-hidden className="animate-spin" />}
                {preview.rows.length === 0
                  ? "Nothing to import"
                  : `Import ${preview.rows.length} ${preview.rows.length === 1 ? "person" : "people"}`}
              </Button>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
