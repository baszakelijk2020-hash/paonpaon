import { requireRetailerRole } from "@paon/auth";
import { RetailerStaffRepository } from "@paon/database";
import { RETAILER_ROLE_LABELS } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function StaffPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "admin");
  } catch {
    redirect("/dashboard");
  }

  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByRetailer(
    session.retailerId,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
            Team
          </h1>
          <p className="text-sm text-[var(--color-stone-500)]">
            {staff.length} team member{staff.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/staff/roster"
            className={buttonVariants({ variant: "outline" })}
          >
            Roster
          </Link>
          <Link href="/staff/new" className={buttonVariants()}>
            Invite teammate
          </Link>
        </div>
      </div>

      <Card className="divide-y divide-[var(--color-stone-100)] overflow-hidden rounded-[var(--radius-md)] p-0 shadow-[var(--shadow-elevated)]">
        {staff.length === 0 ? (
          <div className="flex flex-col items-start gap-3 p-6">
            <p className="text-sm text-[var(--color-stone-500)]">
              No teammates invited yet.
            </p>
            <Link href="/staff/new" className={buttonVariants()}>
              Invite teammate
            </Link>
          </div>
        ) : (
          staff.map((member) => (
            <div
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-[var(--color-stone-900)]">
                  {member.fullName}
                </p>
                <p className="text-sm text-[var(--color-stone-500)]">
                  {member.email} ·{" "}
                  <span className="capitalize">
                    {RETAILER_ROLE_LABELS[member.role]}
                  </span>
                </p>
              </div>
              <Badge
                className="shrink-0"
                tone={member.acceptedAt ? "success" : "warning"}
              >
                {member.acceptedAt ? "Active" : "Invited"}
              </Badge>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
