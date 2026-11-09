import type { Metadata } from "next";
import { SettingsScreen } from "@/components/screens/SettingsScreen";

export const metadata: Metadata = { title: "Profile and settings" };

export default function Page() {
  return <SettingsScreen path="/volunteer/settings" />;
}
