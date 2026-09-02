import {
  CommercialProspectRepository,
  SubscriptionPlanRepository,
} from "@paon/database";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BrandAssetUploader } from "./brand-asset-uploader";
import { DemoPublicationForm } from "./demo-publication-form";
import { EnvironmentPanel } from "./environment-panel";
import { ProspectContactForm } from "./prospect-contact-form";
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
          <Link
            href="/prospects"
            className="text-xs text-[var(--color-stone-500)]"
          >
            ← Prospect workbench
          </Link>
          <p className="mt-6 text-xs uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
            Demo Studio · Version {configuration?.currentVersion ?? 0}
          </p>
          <h1 className="font-display mt-2 text-5xl">{prospect.companyName}</h1>
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            {prospect.primaryContactName} · {prospect.primaryContactEmail}
          </p>
          <ProspectContactForm
            prospectId={prospect.id}
            companyName={prospect.companyName}
            {...(prospect.websiteUrl
              ? { websiteUrl: prospect.websiteUrl }
              : {})}
            primaryContactName={prospect.primaryContactName}
            primaryContactEmail={prospect.primaryContactEmail}
            {...(prospect.primaryContactPhone
              ? { primaryContactPhone: prospect.primaryContactPhone }
              : {})}
            {...(prospect.nextAction
              ? { nextAction: prospect.nextAction }
              : {})}
          />
        </div>
        <div className="rounded-[var(--radius-md)] border bg-white px-5 py-4">
          <p className="text-xs text-[var(--color-stone-500)]">
            Environment status
          </p>
          <p className="mt-1 text-sm font-medium">
            {!configuration
              ? "Research captured · configuration not saved"
              : !environment
                ? "Configuration saved · generate a real demo retailer"
                : environment.status === "published"
                  ? environment.retailerSlug
                    ? `Private demo published · /r/${environment.retailerSlug}`
                    : "Private demo published"
                  : environment.status === "revoked"
                    ? "Private demo revoked · regenerate or republish when ready"
                    : environment.status === "expired"
                      ? "Demo expired · regenerate a fresh tenant for the next call"
                      : environment.retailerSlug
                        ? `Demo retailer ready · /r/${environment.retailerSlug}`
                        : "Demo retailer ready · walk the storefront, then publish"}
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
        initialOutreachPack={environment?.founderOutreachPack}
      />
      {environment ? (
        <section className="flex flex-col gap-5 rounded-[var(--radius-md)] bg-[var(--color-stone-900)] p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
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
          <DemoPublicationForm
            prospectId={prospect.id}
            status={environment.status}
          />
        </section>
      ) : null}
    </div>
  );
}
