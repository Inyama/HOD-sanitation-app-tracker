import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { Outbox } from "./Outbox";

export const metadata: Metadata = { title: "Demo email outbox", robots: { index: false } };

export default function OutboxPage() {
  return (
    <Suspense fallback={<PageSkeleton label="Loading the outbox" />}>
      <Outbox />
    </Suspense>
  );
}
