import { Suspense } from "react";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import type { Metadata } from "next";
import { DesignSystemShowcase } from "./DesignSystemShowcase";

export const metadata: Metadata = {
  title: "Design system",
  description: "Tokens, typography and every core component of HOD Sanitation Hub, in light and dark.",
};

export default function DesignSystemPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DesignSystemShowcase />
    </Suspense>
  );
}
