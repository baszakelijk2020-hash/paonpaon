import {
  CommercialProspectRepository,
  SubscriptionPlanRepository,
} from "@paon/database";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BrandAssetUploader } from "./brand-asset-uploader";
import { StudioForm } from "./studio-form";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function DemoStudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getSupabaseServerClient();
  const prospects = new CommercialProspectRepository(client);
  const plans = new SubscriptionPlanRepository(client);
  const [prospect, configuration, planList, features] = await Promise.all([
    prospects.findById(id),
    prospects.findConfiguration(id),
    plans.findAll(),
    plans.findCommercialFeatures(),
  ]);
  if (!prospect) notFound();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/prospects" className="text-xs text-stone-500">
            ← Prospect workbench
          </Link>
          <p className="mt-6 text-xs uppercase tracking-[0.18em] text-stone-500">
            Demo Studio · Version {configuration?.currentVersion ?? 0}
          </p>
          <h1 className="mt-2 text-5xl font-[var(--font-display)]">
            {prospect.companyName}
          </h1>
          <p className="mt-3 text-sm text-stone-500">
            {prospect.primaryContactName} · {prospect.primaryContactEmail}
          </p>
        </div>
        <div className="rounded-[1.25rem] border bg-white px-5 py-4">
          <p className="text-xs text-stone-500">Environment status</p>
          <p className="mt-1 text-sm font-medium">
            {configuration
              ? "Configuration saved · synthetic data not generated"
              : "Research captured · configuration not saved"}
          </p>
        </div>
      </div>
      <BrandAssetUploader prospectId={prospect.id} />
      <StudioForm
        prospectId={prospect.id}
        companyName={prospect.companyName}
        plans={planList}
        features={features}
        configuration={configuration}
      />
    </div>
  );
}
