import { SubscriptionPlanRepository } from "@paon/database";

import { PlanRow } from "./plan-row";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function BillingPlansPage() {
  await requireSession();
  const supabase = await getSupabaseServerClient();
  const plans = await new SubscriptionPlanRepository(supabase).findAll();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium text-[var(--color-stone-900)]">
          Billing plans
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          PAON&rsquo;s own subscription tiers. Create the matching Product and
          Price for each in the Stripe dashboard, then paste the Price id here —
          see docs/PROJECT_STATE.md &ldquo;Credentials needed&rdquo;.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {plans.map((plan) => (
          <PlanRow key={plan.id} plan={plan} />
        ))}
      </div>
    </div>
  );
}
