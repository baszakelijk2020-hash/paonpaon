import {
  RetailerRepository,
  RetailerStaffRepository,
  RetailerSubscriptionRepository,
  SubscriptionPlanRepository,
} from "@paon/database";
import { asId } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import { notFound } from "next/navigation";

import { RetailerStatusBadge } from "../status-badge";

import { BillingPanel } from "./billing-panel";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function RetailerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const retailer = await new RetailerRepository(supabase).findById(
    asId<"RetailerId">(id),
  );

  if (!retailer) {
    notFound();
  }

  const staff = await new RetailerStaffRepository(supabase).findByRetailer(
    retailer.id,
  );
  const subscription = await new RetailerSubscriptionRepository(
    supabase,
  ).findByRetailer(retailer.id);
  const plans = await new SubscriptionPlanRepository(supabase).findAll();
  const currentPlan = subscription
    ? (plans.find((candidate) => candidate.id === subscription.planId) ?? null)
    : null;
  const assignablePlans = plans.filter(
    (candidate) => candidate.providerPriceId,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
            {retailer.displayName}
          </h1>
          <RetailerStatusBadge status={retailer.status} />
        </div>
        <p className="text-sm text-[var(--color-stone-500)]">
          {retailer.legalName} · {retailer.slug}
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
            Currency / locale
          </p>
          <p className="text-[var(--color-stone-900)]">
            {retailer.defaultCurrency} · {retailer.defaultLocale}
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

      <BillingPanel
        retailerId={retailer.id}
        subscription={subscription}
        plan={currentPlan}
        assignablePlans={assignablePlans}
      />

      <div>
        <h2 className="mb-3 text-lg font-medium text-[var(--color-stone-900)]">
          Staff
        </h2>
        <Card className="divide-y divide-[var(--color-stone-100)] overflow-hidden rounded-[var(--radius-xl)] p-0 shadow-[var(--shadow-elevated)]">
          {staff.length === 0 ? (
            <p className="p-6 text-sm text-[var(--color-stone-500)]">
              No staff invited yet.
            </p>
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
                    <span className="capitalize">{member.role}</span>
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
    </div>
  );
}
