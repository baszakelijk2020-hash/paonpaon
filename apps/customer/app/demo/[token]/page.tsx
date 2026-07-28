import { CommercialProspectRepository } from "@paon/database";
import type { Metadata } from "next";

import { PrivateDemo } from "./private-demo";

import { env } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const preview = await new CommercialProspectRepository(
    await getSupabaseServerClient(),
  ).previewPublishedDemo(token);
  if (!preview) {
    return {
      title: "Private demonstration",
      description: "A time-limited PAON retailer demonstration.",
      robots: { index: false, follow: false },
    };
  }
  const title = preview.marketingHeadline
    ? `${preview.companyName} — ${preview.marketingHeadline}`
    : `${preview.companyName} · private PAON demo`;
  const description =
    preview.marketingHeadline ??
    `A private demonstration of ${preview.companyName} on PAON.`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      ...(preview.heroImageUrl || preview.logoUrl
        ? { images: [preview.heroImageUrl ?? preview.logoUrl!] }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(preview.heroImageUrl || preview.logoUrl
        ? { images: [preview.heroImageUrl ?? preview.logoUrl!] }
        : {}),
    },
  };
}

export default async function PrivateDemoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const preview = await new CommercialProspectRepository(
    await getSupabaseServerClient(),
  ).previewPublishedDemo(token);
  return (
    <PrivateDemo
      publicToken={token}
      retailerAppUrl={env.retailerAppUrl}
      preview={preview ?? undefined}
    />
  );
}
