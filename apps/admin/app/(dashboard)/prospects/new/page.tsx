import { SubscriptionPlanRepository } from "@paon/database";

import { ProspectForm } from "../prospect-form";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function NewProspectPage() {
  const plans = await new SubscriptionPlanRepository(
    await getSupabaseServerClient(),
  ).findAll();
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
          Demo Studio
        </p>
        <h1 className="mt-2 text-5xl font-[var(--font-display)]">
          Begin with a commercial point of view.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-500">
          Record only business research and contact context. Customer data is
          never imported to make a demonstration.
        </p>
      </div>
      <ProspectForm plans={plans} />
    </div>
  );
}
