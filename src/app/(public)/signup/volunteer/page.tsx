import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Join as a volunteer",
  description: "Sign up to serve actively as a Sanitation Unit volunteer.",
};

export default function VolunteerSignupPage() {
  return (
    <AuthShell
      wide
      title="Volunteer with the unit"
      subtitle="Volunteers take on duties, events and team roles, and keep every member feature. A unit admin approves each volunteer."
    >
      <SignupForm role="VOLUNTEER" />
    </AuthShell>
  );
}
