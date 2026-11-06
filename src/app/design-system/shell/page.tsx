import { Suspense } from "react";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import type { Metadata } from "next";
import { ShellPreview } from "./ShellPreview";

export const metadata: Metadata = {
  title: "App shell preview",
  description: "The member, volunteer and admin application frames.",
};

export default function ShellPreviewPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ShellPreview />
    </Suspense>
  );
}
