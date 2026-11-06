import { Suspense } from "react";
import { AreaGate } from "@/components/layout/AreaGate";
import { PageSkeleton } from "@/components/layout/PageSkeleton";

export default function VolunteerLayout({ children }: LayoutProps<"/volunteer">) {
  return (
    <Suspense fallback={<PageSkeleton label="Loading your area" />}>
      <AreaGate area="volunteer">{children}</AreaGate>
    </Suspense>
  );
}
