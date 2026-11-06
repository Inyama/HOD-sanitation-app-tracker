import { PlaceholderPage } from "@/components/layout/PlaceholderPage";

export default function MemberScreen({ params }: PageProps<"/member/[...slug]">) {
  return <PlaceholderPage area="member" params={params} />;
}
