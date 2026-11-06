import "server-only";
import { AppShell } from "./AppShell";
import { NAV, type ShellRole } from "./nav";
import { requirePage } from "@/lib/auth/session";
import { canAccessPath } from "@/lib/auth/permissions";
import { repo } from "@/lib/repo";
import { ADMIN_LEVEL_LABELS, TITLE_LABELS } from "@/lib/repo/types";

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
  return (
    <AppShell role={area} user={{ name: user.name, email: user.email, detail }} unread={unread} hiddenNav={hiddenNav}>
      {children}
    </AppShell>
  );
}
