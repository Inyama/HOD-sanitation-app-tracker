import type { Metadata } from "next";
import { AttendanceScreen } from "@/components/screens/AttendanceScreen";

export const metadata: Metadata = { title: "My attendance" };

export default function Page() {
  return <AttendanceScreen path="/member/attendance" />;
}
