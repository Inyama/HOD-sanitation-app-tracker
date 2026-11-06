import { PlaceholderPage } from "@/components/layout/PlaceholderPage";

export default function VolunteerScreen({ params }: PageProps<"/volunteer/[...slug]">) {
  return <PlaceholderPage area="volunteer" params={params} />;
}
