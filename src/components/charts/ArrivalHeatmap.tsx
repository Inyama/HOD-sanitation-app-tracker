import { cn } from "@/lib/utils";

interface ArrivalHeatmapProps {
  title: string;
  description?: string;
  /** Column labels: minutes from the meeting start ("−60" … "+105"). */
  columns: string[];
  rows: { label: string; cells: number[] }[];
  max: number;
  className?: string;
}

/**
 * Weekday by arrival-time heatmap for the admin dashboard (spec 7.4). One sequential hue,
 * light to dark; every cell also prints its count, so colour is never the only signal.
 * It is a real table, so screen readers can move by row and column.
 */
export function ArrivalHeatmap({ title, description, columns, rows, max, className }: ArrivalHeatmapProps) {
  const startIndex = columns.indexOf("0");
  return (
    <section
      aria-labelledby="arrivals-title"
      className={cn("rounded-(--radius-lg) border border-border bg-card p-5 shadow-soft", className)}
    >
      <h2 id="arrivals-title" className="text-base font-semibold">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {rows.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">No check-ins in this period.</p>
      ) : (
        <div className="relative mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label={`${title} table`}>
          <table className="w-full min-w-[560px] border-separate border-spacing-[3px] text-center text-xs">
            <caption className="sr-only">
              Number of check-ins by weekday and minutes from the meeting start. Negative numbers are early arrivals.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="w-28 text-left font-medium text-muted-foreground">
                  <span className="sr-only">Meeting day</span>
                </th>
                {columns.map((c, i) => (
                  <th
                    key={c}
                    scope="col"
                    className={cn(
                      "tabular pb-1 font-medium text-muted-foreground",
                      i === startIndex && "font-bold text-foreground",
                    )}
                  >
                    {c}
                    <span className="sr-only"> minutes</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row" className="pr-2 text-left text-sm font-medium">
                    {r.label}
                  </th>
                  {r.cells.map((n, i) => {
                    const share = max ? n / max : 0;
                    // Capped at 60% so the normal text colour keeps strong contrast on every cell, in both themes.
                    const pct = n === 0 ? 0 : Math.round(10 + share * 50);
                    return (
                      <td
                        key={i}
                        className={cn(
                          "tabular h-10 rounded-[4px] font-semibold",
                          i === startIndex && "outline-2 outline-offset-1 outline-foreground/30",
                          "text-foreground",
                          n === 0 && "font-normal text-muted-foreground",
                        )}
                        style={{
                          background:
                            n === 0 ? "var(--muted)" : `color-mix(in oklab, var(--series-1) ${pct}%, var(--card))`,
                        }}
                      >
                        {n}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">
            Minutes from the start of each meeting, in 15-minute slots. The outlined column is the start time; arrivals
            after it count as Late.
          </p>
        </div>
      )}
    </section>
  );
}
