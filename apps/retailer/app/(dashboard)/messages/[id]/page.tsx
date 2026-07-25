import { CustomerRepository, MessagingRepository } from "@paon/database";
import { CONVERSATION_INTENT_LABELS } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Image from "next/image";
import { notFound } from "next/navigation";

import { sendMessage } from "../actions";

import { AttachFileInput } from "./attach-file-input";

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
  const [messages, customer, attachments] = await Promise.all([
    repo.findMessages(conversation.id),
    new CustomerRepository(client).findById(conversation.customerId),
    repo.findAttachmentsByConversation(conversation.id),
  ]);

  const attachmentsByMessage = new Map<
    string,
    {
      attachment: (typeof attachments)[number]["attachment"];
      signedUrl: string;
    }[]
  >();
  for (const entry of attachments) {
    const key = entry.attachment.messageId;
    const existing = attachmentsByMessage.get(key) ?? [];
    existing.push(entry);
    attachmentsByMessage.set(key, existing);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-[var(--font-display)]">
            {customer?.fullName ?? "Customer"}
          </h1>
          {conversation.intent ? (
            <Badge tone="neutral">
              {CONVERSATION_INTENT_LABELS[conversation.intent]}
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-[var(--color-stone-500)]">
          {customer?.userId
            ? "Shared retailer conversation"
            : "Storefront inquiry — no portal account yet"}
        </p>
      </div>

      {attachments.length > 0 ? (
        <div>
          <p className="mb-2 text-[11px] font-[var(--font-accent)] uppercase tracking-[0.16em] text-[var(--color-stone-500)]">
            Shared images
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {attachments.map(({ attachment, signedUrl }) => (
              <a
                key={attachment.id}
                href={signedUrl}
                target="_blank"
                rel="noreferrer"
                className="block shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-stone-200)]"
              >
                <Image
                  src={signedUrl}
                  alt={attachment.fileName}
                  width={72}
                  height={72}
                  unoptimized
                  className="size-[72px] object-cover"
                />
              </a>
            ))}
          </div>
        </div>
      ) : null}

      <Card className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto">
        {messages.map((msg) => {
          const msgAttachments = attachmentsByMessage.get(msg.id) ?? [];
          return (
            <div
              key={msg.id}
              className={`max-w-[85%] rounded-lg px-4 py-3 ${msg.senderType === "staff" ? "ml-auto bg-[var(--color-stone-900)] text-white" : "bg-[var(--color-stone-100)]"}`}
            >
              <p className="text-sm">{msg.body}</p>
              {msgAttachments.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {msgAttachments.map(({ attachment, signedUrl }) => (
                    <a
                      key={attachment.id}
                      href={signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-[var(--radius-sm)]"
                    >
                      <Image
                        src={signedUrl}
                        alt={attachment.fileName}
                        width={160}
                        height={160}
                        unoptimized
                        className="max-h-40 w-auto object-cover"
                      />
                    </a>
                  ))}
                </div>
              ) : null}
              <p className="mt-1 text-xs opacity-60">
                {formatDate(msg.createdAt, "en-US")}
              </p>
            </div>
          );
        })}
      </Card>

      <form
        action={sendMessage}
        encType="multipart/form-data"
        className="flex flex-col gap-2"
      >
        <input type="hidden" name="conversationId" value={conversation.id} />
        <div className="flex gap-2">
          <textarea
            name="body"
            required
            maxLength={5000}
            aria-label="Message"
            className="min-h-20 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-stone-300)] p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink-600)] focus-visible:ring-offset-2"
            placeholder="Write a message"
          />
          <Button type="submit">Send</Button>
        </div>
        <AttachFileInput />
      </form>
    </div>
  );
}
