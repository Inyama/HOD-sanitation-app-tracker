import { Suspense } from "react";
import { AreaGate } from "@/components/layout/AreaGate";
import { PageSkeleton } from "@/components/layout/PageSkeleton";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<PageSkeleton label="Loading the admin area" />}>
      <AreaGate area="admin">{children}</AreaGate>
    </Suspense>
  );
}
