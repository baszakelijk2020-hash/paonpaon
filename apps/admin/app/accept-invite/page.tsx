import { PlatformStaffRepository } from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import { redirect } from "next/navigation";

import { AcceptInviteForm } from "./accept-invite-form";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function AcceptInvitePage() {
  const session = await getSession();
  if (!session || session.accountType !== "platform") redirect("/login");
  const supabase = await getSupabaseServerClient();
  const staff = await new PlatformStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!staff) redirect("/login?error=invalid_invite");
  if (staff.acceptedAt) redirect("/retailers");
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="mb-1 text-sm font-medium uppercase tracking-wide text-[var(--color-stone-500)]">
          PAON Admin
        </p>
        <h1 className="mb-2 text-2xl font-medium text-[var(--color-stone-900)]">
          Set your password
        </h1>
        <p className="mb-6 text-sm text-[var(--color-stone-600)]">
          Welcome, {staff.fullName}. Finish joining the PAON platform team.
        </p>
        <Card>
          <AcceptInviteForm staffId={staff.id} />
        </Card>
      </div>
    </main>
  );
}
