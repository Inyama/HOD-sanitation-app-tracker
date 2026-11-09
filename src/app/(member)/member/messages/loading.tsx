import { PageSkeleton } from "@/components/layout/PageSkeleton";

/** Fallback for client navigations between pages of this area, so they can show something at once. */
export default function Loading() {
  return <PageSkeleton bare label="Loading page" />;
}
