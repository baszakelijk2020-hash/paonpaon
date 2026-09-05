import { RetailerRepository } from "@paon/database";
import { notFound } from "next/navigation";

import { ConfiguratorPanel } from "./configurator-panel";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function ConfiguratorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireSession();
  const supabase = await getSupabaseServerClient();
  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer || retailer.status !== "active") notFound();

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col px-6 py-10">
      <div className="mb-6 text-center">
        <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
          {retailer.displayName}
        </p>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Build your suit
        </h1>
        <p className="mt-1 text-sm text-[var(--color-stone-500)]">
          Swipe or tap through lapel, pocket and shoulder options. Predefined
          combinations are shown above.
        </p>
      </div>
      <ConfiguratorPanel slug={slug} retailerId={retailer.id} />
    </main>
  );
}
