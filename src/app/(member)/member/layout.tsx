import { Suspense } from "react";
import { AreaGate } from "@/components/layout/AreaGate";
import { PageSkeleton } from "@/components/layout/PageSkeleton";

export default function MemberLayout({ children }: LayoutProps<"/member">) {
  return (
    <Suspense fallback={<PageSkeleton label="Loading your area" />}>
      <AreaGate area="member">{children}</AreaGate>
    </Suspense>
  );
}
