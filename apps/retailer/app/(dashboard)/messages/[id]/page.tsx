import { CustomerRepository, MessagingRepository } from "@paon/database";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import { notFound } from "next/navigation";

import { sendMessage } from "../actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const client = await getSupabaseServerClient();
  const repo = new MessagingRepository(client);
  const conversation = await repo.findConversation(id as never);
  if (!conversation || conversation.retailerId !== session.retailerId)
    notFound();
  await repo.markRead(conversation.id);
  const [messages, customer] = await Promise.all([
    repo.findMessages(conversation.id),
    new CustomerRepository(client).findById(conversation.customerId),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-medium">
          {customer?.fullName ?? "Customer"}
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Shared retailer conversation
        </p>
      </div>
      <Card className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[85%] rounded-lg px-4 py-3 ${message.senderType === "staff" ? "ml-auto bg-[var(--color-stone-900)] text-white" : "bg-[var(--color-stone-100)]"}`}
          >
            <p className="text-sm">{message.body}</p>
            <p className="mt-1 text-xs opacity-60">
              {formatDate(message.createdAt, "en-US")}
            </p>
          </div>
        ))}
      </Card>
      <form action={sendMessage} className="flex gap-2">
        <input type="hidden" name="conversationId" value={conversation.id} />
        <textarea
          name="body"
          required
          maxLength={5000}
          className="min-h-20 flex-1 rounded border p-3"
          placeholder="Write a message"
        />
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}
