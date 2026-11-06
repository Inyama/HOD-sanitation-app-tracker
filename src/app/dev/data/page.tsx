import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { DataExplorer } from "./DataExplorer";

export const metadata: Metadata = {
  title: "Demo data and rules",
  description: "The deterministic demo unit, demo accounts and live business rules at a simulated time.",
};

export default function DevDataPage() {
  return (
    <Suspense fallback={<PageSkeleton label="Loading demo data" />}>
      <DataExplorer />
    </Suspense>
  );
}
