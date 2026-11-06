"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Rows3, Rows4 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/empty-state";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Value used for sorting; omit to make the column unsortable. */
  sortValue?: (row: T) => string | number | null;
  align?: "left" | "right" | "center";
  /** Hide this field in the mobile card view. */
  hideOnMobile?: boolean;
  /** Use as the card title in the mobile card view. */
  primary?: boolean;
  className?: string;
}

type SortState = { key: string; dir: "asc" | "desc" } | null;

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  caption: string;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (ids: Set<string>) => void;
  initialSort?: SortState;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: React.ReactNode;
  /** Max height of the scroll area so the sticky header has something to stick to. */
  maxHeight?: number;
  toolbar?: React.ReactNode;
  className?: string;
}

/**
 * Spec 3.5 table: sticky header, sortable columns, row selection, density toggle,
 * card view below 640px. Includes loading, empty and error states.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  caption,
  selectable = false,
  selected: selectedProp,
  onSelectedChange,
  initialSort = null,
  loading = false,
  error = null,
  onRetry,
  empty,
  maxHeight = 520,
  toolbar,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = React.useState<SortState>(initialSort);
  const [density, setDensity] = React.useState<"comfortable" | "compact">("comfortable");
  const [innerSelected, setInnerSelected] = React.useState<Set<string>>(new Set());
  const selected = selectedProp ?? innerSelected;
  const setSelected = (s: Set<string>) => (onSelectedChange ? onSelectedChange(s) : setInnerSelected(s));

  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va === vb) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return va > vb ? factor : -factor;
    });
  }, [rows, sort, columns]);

  const allIds = sorted.map(getRowId);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = !allSelected && allIds.some((id) => selected.has(id));

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds));
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const cycleSort = (key: string) =>
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));

  const cellPad = density === "compact" ? "px-3 py-1.5" : "px-4 py-3";
  const primary = columns.find((c) => c.primary) ?? columns[0];

  return (
    <div className={cn("rounded-(--radius-lg) border border-border bg-card shadow-soft", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {toolbar}
          {selectable && selected.size > 0 && (
            <span className="text-sm font-medium text-role-strong" aria-live="polite">
              {selected.size} selected
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDensity((d) => (d === "compact" ? "comfortable" : "compact"))}
          className="hidden h-9 cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground hover:text-foreground sm:inline-flex"
          aria-pressed={density === "compact"}
        >
          {density === "compact" ? <Rows4 aria-hidden className="size-4" /> : <Rows3 aria-hidden className="size-4" />}
          {density === "compact" ? "Compact" : "Comfortable"}
        </button>
      </div>

      {loading ? (
        <LoadingState className="p-4" rows={5} label={`Loading ${caption.toLowerCase()}`} />
      ) : error ? (
        <div className="p-4">
          <ErrorState
            description={error}
            action={
              onRetry && (
                <button type="button" onClick={onRetry} className="cursor-pointer text-sm font-semibold underline">
                  Try again
                </button>
              )
            }
          />
        </div>
      ) : rows.length === 0 ? (
        (empty ?? (
          <EmptyState illustration="search" title="Nothing here yet" description="No rows match these filters." />
        ))
      ) : (
        <>
          {/* Table view, 640px and up */}
          <div
            tabIndex={0}
            role="region"
            aria-label={`${caption} (scrollable)`}
            className="hidden overflow-auto sm:block"
            style={{ maxHeight }}
          >
            <table className="w-full border-separate border-spacing-0 text-sm">
              <caption className="sr-only">{caption}</caption>
              <thead>
                <tr>
                  {selectable && (
                    <th
                      scope="col"
                      className={cn("sticky top-0 z-10 w-10 border-b border-border bg-muted/95 backdrop-blur", cellPad)}
                    >
                      <Checkbox
                        aria-label="Select all rows"
                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                        onCheckedChange={toggleAll}
                      />
                    </th>
                  )}
                  {columns.map((c) => {
                    const active = sort?.key === c.key;
                    const ariaSort = active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none";
                    return (
                      <th
                        key={c.key}
                        scope="col"
                        aria-sort={c.sortValue ? ariaSort : undefined}
                        className={cn(
                          "sticky top-0 z-10 border-b border-border bg-muted/95 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase backdrop-blur",
                          cellPad,
                          c.align === "right" && "text-right",
                          c.align === "center" && "text-center",
                        )}
                      >
                        {c.sortValue ? (
                          <button
                            type="button"
                            onClick={() => cycleSort(c.key)}
                            className="inline-flex cursor-pointer items-center gap-1 uppercase hover:text-foreground"
                          >
                            {c.header}
                            {active ? (
                              sort!.dir === "asc" ? (
                                <ArrowUp aria-hidden className="size-3.5" />
                              ) : (
                                <ArrowDown aria-hidden className="size-3.5" />
                              )
                            ) : (
                              <ArrowUpDown aria-hidden className="size-3.5 opacity-50" />
                            )}
                          </button>
                        ) : (
                          c.header
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => {
                  const id = getRowId(row);
                  const isSel = selected.has(id);
                  return (
                    <tr key={id} className={cn("transition-colors hover:bg-muted/50", isSel && "bg-role-soft/60")}>
                      {selectable && (
                        <td className={cn("border-b border-border/70", cellPad)}>
                          <Checkbox aria-label={`Select row`} checked={isSel} onCheckedChange={() => toggleOne(id)} />
                        </td>
                      )}
                      {columns.map((c) => (
                        <td
                          key={c.key}
                          className={cn(
                            "tabular border-b border-border/70",
                            cellPad,
                            c.align === "right" && "text-right",
                            c.align === "center" && "text-center",
                            c.className,
                          )}
                        >
                          {c.cell(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Card view, below 640px */}
          <ul className="divide-y divide-border sm:hidden" aria-label={caption}>
            {sorted.map((row) => {
              const id = getRowId(row);
              return (
                <li key={id} className="flex gap-3 p-4">
                  {selectable && (
                    <Checkbox
                      aria-label="Select row"
                      className="mt-1"
                      checked={selected.has(id)}
                      onCheckedChange={() => toggleOne(id)}
                    />
                  )}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="font-semibold">{primary.cell(row)}</div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                      {columns
                        .filter((c) => c !== primary && !c.hideOnMobile)
                        .map((c) => (
                          <div key={c.key} className="min-w-0">
                            <dt className="text-xs text-muted-foreground">{c.header}</dt>
                            <dd className="tabular truncate">{c.cell(row)}</dd>
                          </div>
                        ))}
                    </dl>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
