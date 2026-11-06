"use client";

import * as React from "react";
import { Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** "Install the app" (spec 3.9): uses the browser's install prompt when offered, otherwise shows how. */
export function InstallPrompt() {
  const [evt, setEvt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = React.useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(display-mode: standalone)").matches,
  );

  React.useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return <p className="text-sm text-muted-foreground">The app is installed on this device.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Add HOD Sanitation Hub to your home screen to open it like an app and check in faster on Saturdays.
      </p>
      {evt ? (
        <Button
          variant="role"
          onClick={async () => {
            await evt.prompt();
            const choice = await evt.userChoice;
            if (choice.outcome === "accepted") setInstalled(true);
            setEvt(null);
          }}
        >
          <Download aria-hidden /> Install the app
        </Button>
      ) : (
        <ul className="space-y-1.5 text-sm">
          <li className="flex gap-2">
            <Smartphone aria-hidden className="mt-0.5 size-4 shrink-0" /> iPhone: tap Share, then Add to Home Screen.
          </li>
          <li className="flex gap-2">
            <Smartphone aria-hidden className="mt-0.5 size-4 shrink-0" /> Android: open the browser menu, then Install
            app or Add to Home screen.
          </li>
        </ul>
      )}
    </div>
  );
}
