import { BranchCalendarRepository } from "@paon/database";
import { retailerRoleAtLeast } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BranchSetupForm } from "./branch-setup-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function BranchesSettingsPage() {
  const session = await requireSession();
  if (!retailerRoleAtLeast(session.retailerRole, "manager")) {
    redirect("/dashboard");
  }
  const supabase = await getSupabaseServerClient();
  const branches = await new BranchCalendarRepository(supabase).listBranches(
    session.retailerId,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Branches
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Store locations with honest local timezones for the shared appointment
          calendar.{" "}
          <Link href="/appointments/calendar" className="underline">
            Open branch calendar
          </Link>
        </p>
      </div>

      <BranchSetupForm />

      {branches.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">
            No branches yet. Create your primary salon to enable the shared
            calendar.
          </p>
        </div>
      ) : (
        <Card className="divide-y divide-[var(--color-stone-100)] overflow-hidden rounded-[var(--radius-md)] p-0">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className="flex items-center justify-between px-6 py-4"
            >
              <div>
                <p className="font-medium text-[var(--color-stone-900)]">
                  {branch.name}
                  {branch.isPrimary ? (
                    <span className="ml-2 text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
                      Primary
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-[var(--color-stone-500)]">
                  {branch.timezone}
                </p>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
