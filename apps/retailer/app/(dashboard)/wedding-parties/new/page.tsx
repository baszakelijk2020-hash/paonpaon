import { CustomerRepository } from "@paon/database";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { notFound } from "next/navigation";

import { createWeddingParty } from "../actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function NewWeddingPartyPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const session = await requireSession();
  const { customerId } = await searchParams;
  if (!customerId) notFound();

  const supabase = await getSupabaseServerClient();
  const customer = await new CustomerRepository(supabase).findById(
    customerId as never,
  );
  if (!customer || customer.retailerId !== session.retailerId) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Start a wedding party
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Organizer: {customer.fullName}
        </p>
      </div>
      <Card>
        <form action={createWeddingParty} className="flex flex-col gap-4">
          <input type="hidden" name="organizerCustomerId" value={customer.id} />
          <FormField label="Event date" htmlFor="eventDate" hint="Optional">
            <Input id="eventDate" name="eventDate" type="date" />
          </FormField>
          <FormField label="Venue" htmlFor="venueName" hint="Optional">
            <Input id="venueName" name="venueName" />
          </FormField>
          <FormField label="Notes" htmlFor="notes" hint="Optional">
            <textarea
              id="notes"
              name="notes"
              maxLength={2000}
              className="min-h-24 rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] p-3 text-sm"
            />
          </FormField>
          <Button type="submit" className="self-start">
            Create wedding party
          </Button>
        </form>
      </Card>
    </div>
  );
}
