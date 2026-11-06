import { cn } from "@/lib/utils";

const gradients = [
  "linear-gradient(135deg,#1e3a8a,#2563eb)",
  "linear-gradient(135deg,#0d9488,#22c55e)",
  "linear-gradient(135deg,#b8861b,#f5d27a)",
  "linear-gradient(135deg,#7c3aed,#2563eb)",
  "linear-gradient(135deg,#0a1a44,#0d9488)",
  "linear-gradient(135deg,#e11d48,#f59e0b)",
];

export function initials(name: string): string {
  const parts = name
    .replace(/^(pastor|dr|mr|mrs|ms|rev)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Dummy avatars are initials on gradient circles; never photos of real members (spec 3.4). */
export function UserAvatar({ name, size = 40, className }: { name: string; size?: number; className?: string }) {
  const bg = gradients[hash(name) % gradients.length];
  const light = bg.includes("#f5d27a");
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-surface select-none",
        light ? "text-navy-900" : "text-white",
        className,
      )}
      style={{ width: size, height: size, backgroundImage: bg, fontSize: Math.max(11, size * 0.38) }}
    >
      {initials(name)}
    </span>
  );
}
