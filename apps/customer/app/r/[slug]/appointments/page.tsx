import {
  CustomerPreferencesRepository,
  CustomerRepository,
  RetailerRepository,
} from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import { notFound } from "next/navigation";

import { AppointmentRequestForm } from "./appointment-request-form";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function StorefrontAppointmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ occasion?: string; shortlist?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const supabase = await getSupabaseServerClient();

  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer || retailer.status !== "active") {
    notFound();
  }

  const session = await getSession();
  const isSignedIn = !!session && session.accountType === "customer";

  let styleNotes: string | undefined;
  if (isSignedIn && session) {
    const relationships = await new CustomerRepository(supabase).findByUserId(
      session.userId,
    );
    const customer = relationships.find(
      (item) => item.retailerId === retailer.id,
    );
    if (customer) {
      const preferences = await new CustomerPreferencesRepository(
        supabase,
      ).findByCustomer(customer.id);
      styleNotes = preferences?.styleNotes;
    }
  }

  const occasionNotes = [
    query.occasion ? `TableService occasion: ${query.occasion}` : null,
    query.shortlist
      ? `Preliminary shortlist product ids: ${query.shortlist}`
      : null,
    styleNotes ?? null,
  ]
    .filter((part): part is string => !!part && part.trim().length > 0)
    .join("\n");

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <p className="font-accent mb-1 text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
        {retailer.displayName}
      </p>
      <h1 className="font-display mb-6 text-3xl text-[var(--color-stone-900)]">
        Request an appointment
      </h1>
      {query.occasion ? (
        <p className="mb-4 text-sm text-[var(--color-stone-600)]">
          Continuing from TableService guidance for {query.occasion}. An advisor
          will pick up your shortlist in store.
        </p>
      ) : null}
      <Card className="paon-reveal">
        <AppointmentRequestForm
          slug={slug}
          retailerId={retailer.id}
          isSignedIn={isSignedIn}
          {...(occasionNotes ? { defaultNotes: occasionNotes } : {})}
        />
      </Card>
    </main>
  );
}
