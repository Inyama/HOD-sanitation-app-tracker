"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const options = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

const subscribe = () => () => {};

/** Light, dark or system theme. Renders a stable shell until mounted to avoid hydration mismatch. */
export function ThemeToggle({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const current = mounted ? (theme ?? "system") : undefined;

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border p-0.5",
        onDark ? "border-white/20 bg-white/5" : "border-border bg-surface",
        className,
      )}
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors pointer-coarse:size-11",
              active
                ? onDark
                  ? "bg-white/20 text-white"
                  : "bg-role-soft text-role-strong"
                : onDark
                  ? "text-white/70 hover:text-white"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
