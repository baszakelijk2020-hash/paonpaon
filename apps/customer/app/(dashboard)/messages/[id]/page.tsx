import { MessagingRepository, RetailerRepository } from "@paon/database";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Image from "next/image";
import { notFound } from "next/navigation";

import { retryAttachmentScan, sendMessage } from "../actions";

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
  const [messages, retailer, attachments] = await Promise.all([
    repo.findMessages(conversation.id),
    new RetailerRepository(client).findById(conversation.retailerId),
    repo.findAttachmentsByConversation(conversation.id),
  ]);
  const attachmentsByMessage = new Map<
    string,
    (typeof attachments)[number][]
  >();
  for (const attachment of attachments) {
    const rows =
      attachmentsByMessage.get(attachment.attachment.messageId) ?? [];
    rows.push(attachment);
    attachmentsByMessage.set(attachment.attachment.messageId, rows);
  }
  return (
    <div className="flex min-h-[calc(100dvh-10.5rem)] flex-col gap-5 lg:min-h-0">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          {retailer?.displayName ?? "Retailer"}
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Private conversation
        </p>
      </div>
      <Card className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[85%] rounded-[var(--radius-md)] px-4 py-3 ${message.senderType === "customer" ? "ml-auto bg-[var(--color-stone-900)] text-white" : "bg-[var(--color-stone-100)]"}`}
          >
            <p className="text-sm">{message.body}</p>
            {(attachmentsByMessage.get(message.id) ?? []).map(
              ({ attachment, accessUrl }) =>
                accessUrl ? (
                  <a
                    key={attachment.id}
                    href={accessUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block text-xs underline"
                  >
                    {attachment.purpose === "pinterest_link" ||
                    attachment.mimeType === "application/pdf" ? (
                      attachment.fileName
                    ) : (
                      <Image
                        src={accessUrl}
                        alt={attachment.fileName}
                        width={160}
                        height={160}
                        unoptimized
                        className="max-h-40 w-auto rounded object-cover"
                      />
                    )}
                  </a>
                ) : attachment.scanStatus === "pending_scan" ? (
                  <span key={attachment.id} className="mt-2 block text-xs">
                    {attachment.fileName} — queued for safety scan
                  </span>
                ) : attachment.scanStatus === "failed" ? (
                  <form
                    key={attachment.id}
                    action={retryAttachmentScan}
                    className="mt-2 text-xs"
                  >
                    <input
                      type="hidden"
                      name="attachmentId"
                      value={attachment.id}
                    />
                    <input
                      type="hidden"
                      name="conversationId"
                      value={conversation.id}
                    />
                    <span>{attachment.fileName} — safety scan failed. </span>
                    <button type="submit" className="underline">
                      Retry scan
                    </button>
                  </form>
                ) : (
                  <span key={attachment.id} className="mt-2 block text-xs">
                    {attachment.fileName} — unavailable
                  </span>
                ),
            )}
            <p className="mt-1 text-xs opacity-60">
              {formatDate(message.createdAt, "en-US")}
            </p>
          </div>
        ))}
      </Card>
      <form
        action={sendMessage}
        className="bg-[var(--color-stone-50)]/95 sticky bottom-20 z-10 -mx-4 flex flex-col gap-2 border-t border-[var(--color-stone-200)] px-4 py-3 backdrop-blur sm:flex-row lg:static lg:bottom-auto lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none"
      >
        <input type="hidden" name="conversationId" value={conversation.id} />
        <textarea
          name="body"
          required
          maxLength={5000}
          className="min-h-20 flex-1 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-stone-900)] focus-visible:ring-offset-2"
          placeholder="Write a message"
        />
        <Button type="submit" className="sm:self-end">
          Send
        </Button>
      </form>
    </div>
  );
}
