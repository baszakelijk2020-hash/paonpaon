import { RetailerStaffRepository } from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import { redirect } from "next/navigation";

import { AcceptInviteForm } from "./accept-invite-form";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function AcceptInvitePage() {
  const session = await getSession();
  if (!session || session.accountType !== "retailer_staff") {
    redirect("/login");
  }

  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );

  if (!staff) {
    redirect("/login?error=invalid_invite");
  }
  if (staff.acceptedAt) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="mb-1 text-sm font-medium uppercase tracking-wide text-[var(--color-stone-500)]">
          Retailer Portal
        </p>
        <h1 className="mb-2 text-2xl font-medium text-[var(--color-stone-900)]">
          Set your password
        </h1>
        <p className="mb-6 text-sm text-[var(--color-stone-600)]">
          Welcome, {staff.fullName}. Set a password to finish joining the team.
        </p>
        <Card>
          <AcceptInviteForm staffId={staff.id} />
        </Card>
      </div>
    </main>
  );
}
