import { MessagingRepository, RetailerRepository } from "@paon/database";
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
  await requireSession();
  const { id } = await params;
  const client = await getSupabaseServerClient();
  const repo = new MessagingRepository(client);
  const conversation = await repo.findConversation(id as never);
  if (!conversation) notFound();
  await repo.markRead(conversation.id);
  const [messages, retailer] = await Promise.all([
    repo.findMessages(conversation.id),
    new RetailerRepository(client).findById(conversation.retailerId),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          {retailer?.displayName ?? "Retailer"}
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Private conversation
        </p>
      </div>
      <Card className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[85%] rounded-[var(--radius-md)] px-4 py-3 ${message.senderType === "customer" ? "ml-auto bg-[var(--color-stone-900)] text-white" : "bg-[var(--color-stone-100)]"}`}
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
          className="min-h-20 flex-1 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3"
          placeholder="Write a message"
        />
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}
