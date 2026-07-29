import {
  CustomerRepository,
  MessagingRepository,
  RetailerRepository,
} from "@paon/database";
import { Button, buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";

import { startConversation } from "./actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";
export default async function MessagesPage() {
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Messages
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Speak directly with your retail advisors.
        </p>
      </div>
      {rows.map(({ customer, retailer, conversation }) => (
        <Card key={customer.id}>
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
                className={buttonVariants({ size: "sm" })}
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
                className="h-10 flex-1 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3"
                placeholder="How may the team help?"
              />
              <Button type="submit" size="sm" className="sm:self-end">
                Start
              </Button>
            </form>
          ) : null}
        </Card>
      ))}
      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-stone-500)]">
            A retailer relationship is required before messaging.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
