import "server-only";
import { AppShell } from "./AppShell";
import { SchedulerTick } from "./SchedulerTick";
import { NAV, type ShellRole } from "./nav";
import { requirePage } from "@/lib/auth/session";
import { canAccessPath } from "@/lib/auth/permissions";
import { repo } from "@/lib/repo";
import { ADMIN_LEVEL_LABELS, TITLE_LABELS } from "@/lib/repo/types";
import { cookies } from "next/headers";
import { serverNow } from "@/lib/time/server-now";
import { MEETING_ZONE } from "@/lib/time/zone";
import { RANGE_COOKIE, resolveRange } from "@/lib/admin/range";
import { DateRangePicker } from "@/components/admin/DateRangePicker";

/**
 * Server gate for an area layout: checks the session and permissions with fresh data,
 * hides navigation the person cannot open, and renders the role shell.
 * Pages inside still call requirePage(path) themselves, because layouts do not re-run on
 * client navigation between sibling pages.
 */
export async function AreaGate({ area, children }: { area: ShellRole; children: React.ReactNode }) {
  const { user, titles, actor } = await requirePage(`/${area}`);
  const unread = await repo().notifications.count({ where: { userId: user.id, channel: "IN_APP", readAt: null } });
  const hiddenNav = NAV[area]
    .flatMap((g) => g.items)
    .map((i) => i.href)
    .filter((href) => !canAccessPath(actor, href));
  const detail = user.adminLevel
    ? ADMIN_LEVEL_LABELS[user.adminLevel]
    : titles.map((t) => TITLE_LABELS[t]).join(", ") || undefined;
  let dateRange: React.ReactNode = undefined;
  let badges: Record<string, number> | undefined;
  if (area === "admin") {
    const now = await serverNow();
    const range = resolveRange((await cookies()).get(RANGE_COOKIE)?.value, now);
    dateRange = (
      <DateRangePicker
        value={range.value}
        label={range.label}
        fromDate={range.fromDate}
        toDate={range.toDate}
        today={now.setZone(MEETING_ZONE).toISODate()!}
      />
    );
    if (!hiddenNav.includes("/admin/approvals")) {
      const r = repo();
      const [pending, active] = await Promise.all([
        r.users.count({ where: { status: "PENDING" } }),
        r.users.list({ whereIn: { status: ["ACTIVE", "SUSPENDED"] } }),
      ]);
      badges = { "/admin/approvals": pending + active.filter((u) => u.deletionRequestedAt).length };
    }
  }
  return (
    <>
      <SchedulerTick />
      <AppShell
        role={area}
        user={{ name: user.name, email: user.email, detail, avatarUrl: user.avatarUrl }}
        unread={unread}
        hiddenNav={hiddenNav}
        dateRange={dateRange}
        badges={badges}
      >
        {children}
      </AppShell>
    </>
  );
}
