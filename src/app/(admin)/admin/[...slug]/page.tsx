import { PlaceholderPage } from "@/components/layout/PlaceholderPage";

export default function AdminScreen({ params }: PageProps<"/admin/[...slug]">) {
  return <PlaceholderPage area="admin" params={params} />;
}
