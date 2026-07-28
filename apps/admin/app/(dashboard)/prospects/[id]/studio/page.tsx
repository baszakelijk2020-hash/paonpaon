import {
  CommercialProspectRepository,
  SubscriptionPlanRepository,
} from "@paon/database";
import Link from "next/link";
import { notFound } from "next/navigation";

import { setDemoPublication } from "./actions";
import { BrandAssetUploader } from "./brand-asset-uploader";
import { EnvironmentPanel } from "./environment-panel";
import { StudioForm } from "./studio-form";

import { env } from "@/lib/env";
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
  const [prospect, configuration, environment, planList, features] =
    await Promise.all([
      prospects.findById(id),
      prospects.findConfiguration(id),
      prospects.findEnvironment(id),
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
          <h1 className="font-display mt-2 text-5xl">{prospect.companyName}</h1>
          <p className="mt-3 text-sm text-stone-500">
            {prospect.primaryContactName} · {prospect.primaryContactEmail}
          </p>
        </div>
        <div className="rounded-[1.25rem] border bg-white px-5 py-4">
          <p className="text-xs text-stone-500">Environment status</p>
          <p className="mt-1 text-sm font-medium">
            {configuration
              ? "Configuration saved · generate a real demo retailer"
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
      <EnvironmentPanel
        prospectId={prospect.id}
        environment={environment}
        customerAppUrl={env.customerAppUrl}
        retailerAppUrl={env.retailerAppUrl}
        contactEmail={prospect.primaryContactEmail}
      />
      {environment ? (
        <section className="flex flex-col gap-5 rounded-[1.25rem] bg-stone-900 p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">
              Publication boundary
            </p>
            <h2 className="font-display mt-2 text-3xl">
              {environment.status === "published"
                ? "This private demo is available."
                : "The preview remains internal."}
            </h2>
            <p className="mt-2 text-sm text-white/55">
              {environment.status === "published"
                ? "Revoke immediately to close the link without deleting the configuration."
                : "Publish after walking the live storefront and a seeded persona login."}
            </p>
          </div>
          <form action={setDemoPublication}>
            <input type="hidden" name="prospectId" value={prospect.id} />
            <input
              type="hidden"
              name="publish"
              value={environment.status === "published" ? "false" : "true"}
            />
            <button
              type="submit"
              className="min-h-11 rounded-md bg-white px-5 text-sm text-black"
            >
              {environment.status === "published"
                ? "Revoke private demo"
                : "Publish private demo"}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
