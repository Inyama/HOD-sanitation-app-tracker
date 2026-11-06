import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Join as a member",
  description: "Sign up to serve with the Sanitation Unit of Household of David.",
};

export default function MemberSignupPage() {
  return (
    <AuthShell
      wide
      title="Join the Sanitation Unit"
      subtitle="Create your member account. After you confirm your email, a unit admin will approve you, usually within two days."
    >
      <SignupForm role="MEMBER" />
    </AuthShell>
  );
}
