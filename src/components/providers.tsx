"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "framer-motion";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { clockMode, startDemoClock } from "@/lib/time/clock";
import { isDemoMode } from "@/lib/env";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } },
      }),
  );

  React.useEffect(() => {
    // Demo world is anchored on Friday 6 November 2026 (spec section 0).
    if (isDemoMode() && clockMode() === "real") startDemoClock();
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster position="top-center" richColors closeButton />
          </TooltipProvider>
        </QueryClientProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
