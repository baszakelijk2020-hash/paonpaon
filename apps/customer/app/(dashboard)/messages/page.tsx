import {
  CustomerRepository,
  MessagingRepository,
  RetailerRepository,
} from "@paon/database";
import { Button } from "@paon/ui/components/Button";
import Link from "next/link";

import { RelatedLinks } from "../related-links";

import { startConversation } from "./actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ prefill?: string }>;
}) {
  const { prefill } = await searchParams;
  const session = await requireSession();
  const client = await getSupabaseServerClient();
  const customers = await new CustomerRepository(client).findByUserId(
    session.userId,
  );
  const messaging = new MessagingRepository(client);
  const retailers = new RetailerRepository(client);
  const rows = await Promise.all(
    customers.map(async (customer) => ({
      customer,
      retailer: await retailers.findById(customer.retailerId),
      conversation: await messaging.findByCustomer(customer.id),
    })),
  );
  return (
    <div className="customer-page flex flex-col gap-6">
      <header className="customer-page-header flex-col items-start gap-2">
        <h1 className="font-display text-4xl text-[var(--customer-ink)]">
          Messages
        </h1>
        <p className="max-w-2xl text-base text-[var(--color-stone-600)]">
          Speak directly with your retail advisors.
        </p>
        <RelatedLinks
          links={[
            { href: "/events", label: "Events" },
            { href: "/wedding-parties", label: "Wedding Parties" },
            { href: "/notifications", label: "Updates" },
          ]}
        />
      </header>
      {rows.map(({ customer, retailer, conversation }) => (
        <section key={customer.id} className="customer-panel p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-medium">
                {retailer?.displayName ?? "Retailer"}
              </h2>
              <p className="text-sm text-[var(--color-stone-500)]">
                Private retailer conversation
              </p>
            </div>
            {conversation ? (
              <Link
                href={`/messages/${conversation.id}`}
                className="customer-button"
              >
                Open
              </Link>
            ) : null}
          </div>
          {!conversation ? (
            <form
              action={startConversation}
              className="mt-4 flex flex-col gap-2 sm:flex-row"
            >
              <input
                type="hidden"
                name="retailerId"
                value={customer.retailerId}
              />
              <input
                name="body"
                required
                maxLength={5000}
                defaultValue={prefill}
                className="h-16 flex-1 rounded-[var(--customer-radius)] border border-[var(--customer-border)] bg-white/70 px-4 text-[var(--customer-ink)] outline-none transition-colors placeholder:text-[var(--color-stone-500)] focus:border-[var(--customer-ink)]"
                placeholder="How may the team help?"
              />
              <Button
                type="submit"
                size="sm"
                className="customer-button sm:self-end"
              >
                Start
              </Button>
            </form>
          ) : null}
        </section>
      ))}
      {rows.length === 0 ? (
        <section className="customer-panel p-6">
          <p className="text-sm text-[var(--color-stone-500)]">
            A retailer relationship is required before messaging.
          </p>
        </section>
      ) : null}
    </div>
  );
}
