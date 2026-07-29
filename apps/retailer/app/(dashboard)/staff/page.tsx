import { requireRetailerRole } from "@paon/auth";
import { RetailerStaffRepository } from "@paon/database";
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
            Staff
          </h1>
          <p className="text-sm text-[var(--color-stone-500)]">
            {staff.length} staff member{staff.length === 1 ? "" : "s"}
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
            Invite staff
          </Link>
        </div>
      </div>

      <Card className="divide-y divide-[var(--color-stone-100)] overflow-hidden rounded-[var(--radius-md)] p-0 shadow-[var(--shadow-elevated)]">
        {staff.length === 0 ? (
          <p className="p-6 text-sm text-[var(--color-stone-500)]">
            No staff invited yet.
          </p>
        ) : (
          staff.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between px-6 py-4"
            >
              <div>
                <p className="font-medium text-[var(--color-stone-900)]">
                  {member.fullName}
                </p>
                <p className="text-sm text-[var(--color-stone-500)]">
                  {member.email} ·{" "}
                  <span className="capitalize">{member.role}</span>
                </p>
              </div>
              <Badge tone={member.acceptedAt ? "success" : "warning"}>
                {member.acceptedAt ? "Active" : "Invited"}
              </Badge>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
