import { CustomerRepository, MessagingRepository } from "@paon/database";
import { CONVERSATION_INTENT_LABELS } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Link from "next/link";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";
export default async function MessagesPage() {
  const session = await requireSession();
  const client = await getSupabaseServerClient();
  const [conversations, customers] = await Promise.all([
    new MessagingRepository(client).findByRetailer(session.retailerId),
    new CustomerRepository(client).findByRetailer(session.retailerId),
  ]);
  const names = new Map(customers.map((item) => [item.id, item.fullName]));
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium">Messages</h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Customer conversations shared by the retail team.
        </p>
      </div>
      <Card className="divide-y p-0">
        {conversations.map((item) => (
          <Link
            key={item.id}
            href={`/messages/${item.id}`}
            className="flex justify-between px-6 py-4 hover:bg-[var(--color-stone-50)]"
          >
            <span className="flex items-center gap-2">
              <span className="font-medium">
                {names.get(item.customerId) ?? "Customer"}
              </span>
              {item.intent ? (
                <Badge tone="neutral">
                  {CONVERSATION_INTENT_LABELS[item.intent]}
                </Badge>
              ) : null}
            </span>
            <span className="text-sm text-[var(--color-stone-500)]">
              {item.lastMessageAt
                ? formatDate(item.lastMessageAt, "en-US")
                : "New"}
            </span>
          </Link>
        ))}
        {conversations.length === 0 ? (
          <p className="p-6 text-sm text-[var(--color-stone-500)]">
            Start a conversation from a customer record.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
