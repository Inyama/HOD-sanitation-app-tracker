"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { passwordStrength } from "@/lib/auth/strength";
import { cn } from "@/lib/utils";

type InputProps = React.ComponentProps<typeof Input>;

/** Password input with a show/hide toggle (spec 4.3). */
export const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(function PasswordInput(
  { className, ...props },
  ref,
) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={show ? "text" : "password"} className={cn("pr-12", className)} {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute top-1/2 right-1 inline-flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
      </button>
    </div>
  );
});

const barColor = ["bg-(--status-absent)", "bg-(--status-absent)", "bg-(--status-late)", "bg-success", "bg-success"];

/** Strength meter: four bars plus a word and hints, so it does not rely on colour. */
export function StrengthMeter({ password, id }: { password: string; id?: string }) {
  const s = passwordStrength(password);
  if (!password) return null;
  return (
    <div id={id} className="space-y-1.5" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= s.score ? barColor[s.score] : "bg-mist")} />
        ))}
      </div>
      <p className="text-xs">
        <span className="font-semibold">Strength: {s.label}.</span>{" "}
        <span className="text-muted-foreground">{s.hints[0] ?? "Nice and strong."}</span>
      </p>
    </div>
  );
}
