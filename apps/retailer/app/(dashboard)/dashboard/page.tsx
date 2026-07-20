import { RetailerRepository, RetailerStaffRepository } from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import { notFound, redirect } from "next/navigation";

import { RetailerStatusBadge } from "../status-badge";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function DashboardPage() {
  const session = await requireSession();
  if (["workshop_manager", "worker"].includes(session.retailerRole)) {
    redirect("/alterations");
  }
  const supabase = await getSupabaseServerClient();

  const retailer = await new RetailerRepository(supabase).findById(
    session.retailerId,
  );
  if (!retailer) {
    notFound();
  }

  const staff = await new RetailerStaffRepository(supabase).findByRetailer(
    session.retailerId,
  );
  const activeStaffCount = staff.filter((member) => member.acceptedAt).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-[var(--font-display)] text-[var(--color-stone-900)]">
            {retailer.displayName}
          </h1>
          <RetailerStatusBadge status={retailer.status} />
        </div>
        <p className="text-sm text-[var(--color-stone-500)]">
          {retailer.legalName} · {retailer.defaultCurrency} ·{" "}
          {retailer.defaultLocale}
        </p>
      </div>

      <Card className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Tier
          </p>
          <p className="capitalize text-[var(--color-stone-900)]">
            {retailer.tier}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Team
          </p>
          <p className="text-[var(--color-stone-900)]">
            {activeStaffCount} active · {staff.length} total
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Onboarded
          </p>
          <p className="text-[var(--color-stone-900)]">
            {formatDate(retailer.createdAt, "en-US")}
          </p>
        </div>
      </Card>

      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
        <p className="text-[var(--color-stone-600)]">
          Customers, orders, production, alterations, loyalty and clienteling
          land here next — see <code>docs/PRODUCT.md</code> for the full feature
          roadmap.
        </p>
      </div>
    </div>
  );
}
