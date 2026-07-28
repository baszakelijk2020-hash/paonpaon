import { RetailerRepository } from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import { notFound } from "next/navigation";

import { AppointmentRequestForm } from "./appointment-request-form";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function StorefrontAppointmentsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();

  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer || retailer.status !== "active") {
    notFound();
  }

  const session = await getSession();

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <p className="font-accent mb-1 text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
        {retailer.displayName}
      </p>
      <h1 className="font-display mb-6 text-3xl text-[var(--color-stone-900)]">
        Request an appointment
      </h1>
      <Card className="paon-reveal">
        <AppointmentRequestForm
          slug={slug}
          retailerId={retailer.id}
          isSignedIn={!!session && session.accountType === "customer"}
        />
      </Card>
    </main>
  );
}
