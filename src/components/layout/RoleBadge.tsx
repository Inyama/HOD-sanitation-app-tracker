import { cn } from "@/lib/utils";
import { ROLE_META, type ShellRole } from "./nav";

const styles: Record<ShellRole, string> = {
  member: "bg-sky-100 text-royal-700 dark:bg-royal-600/25 dark:text-sky-100",
  volunteer: "bg-[#ccfbf1] text-teal-700 dark:bg-teal-500/20 dark:text-[#99f6e4]",
  admin: "bg-gold-100 text-gold-700 dark:bg-gold-500/20 dark:text-gold-300",
};

/** Role pill with icon and text (never colour alone). */
export function RoleBadge({ role, detail, className }: { role: ShellRole; detail?: string; className?: string }) {
  const Icon = ROLE_META[role].icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        styles[role],
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {ROLE_META[role].label}
      {detail && <span className="font-medium opacity-80">· {detail}</span>}
    </span>
  );
}
