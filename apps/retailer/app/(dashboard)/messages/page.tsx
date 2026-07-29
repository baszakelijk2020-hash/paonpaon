import {
  ClientelingRepository,
  CustomerRepository,
  MessagingRepository,
  OrderRepository,
} from "@paon/database";
import { CONVERSATION_INTENT_LABELS, ORDER_STATUS_LABELS } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate, formatMoney } from "@paon/utils";
import Image from "next/image";
import Link from "next/link";

import { LifecycleBadge } from "../customers/lifecycle-badge";

import { sendMessage } from "./actions";
import { AttachFileInput } from "./attach-file-input";
import {
  ConversationList,
  type ConversationListItem,
} from "./conversation-list";
import { MessageTextarea } from "./message-textarea";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * The staff inbox — a real 3-pane layout (conversation list, thread,
 * customer context), not the previous list-then-navigate-away pattern.
 * On small screens: list-only until `?c=` selects a thread; context
 * pane appears from `lg` up. All three panes are wired to the actual
 * repositories already used elsewhere in the app.
 */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c: selectedId } = await searchParams;
  const session = await requireSession();
  const client = await getSupabaseServerClient();
  const messagingRepo = new MessagingRepository(client);
  const customerRepo = new CustomerRepository(client);
  const explicitSelection = Boolean(selectedId);

  const [conversations, customers] = await Promise.all([
    messagingRepo.findByRetailer(session.retailerId),
    customerRepo.findByRetailer(session.retailerId),
  ]);
  const customerById = new Map(customers.map((item) => [item.id, item]));

  const sorted = [...conversations].sort((a, b) =>
    (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""),
  );

  const listItems: ConversationListItem[] = await Promise.all(
    sorted.map(async (conversation) => {
      const messages = await messagingRepo.findMessages(conversation.id);
      const last = messages[messages.length - 1];
      return {
        id: conversation.id,
        customerName:
          customerById.get(conversation.customerId)?.fullName ?? "Customer",
        intentLabel: conversation.intent
          ? CONVERSATION_INTENT_LABELS[conversation.intent]
          : null,
        lastMessageAt: conversation.lastMessageAt ?? null,
        preview: last?.body ?? "No messages yet",
        awaitingReply: last
          ? last.senderType === "customer" || last.senderType === "guest"
          : false,
      };
    }),
  );

  const activeId = selectedId ?? listItems[0]?.id ?? null;
  const activeConversation = activeId
    ? (conversations.find((item) => item.id === activeId) ?? null)
    : null;

  let thread: Awaited<ReturnType<MessagingRepository["findMessages"]>> = [];
  let attachmentsByMessage = new Map<
    string,
    { attachment: { id: string; fileName: string }; signedUrl: string }[]
  >();
  let activeCustomer: Awaited<ReturnType<CustomerRepository["findById"]>> =
    null;
  let orders: Awaited<ReturnType<OrderRepository["findByCustomer"]>> = [];
  let notes: Awaited<ReturnType<ClientelingRepository["findByCustomer"]>> = [];

  if (activeConversation) {
    await messagingRepo.markRead(activeConversation.id);
    const [messages, attachments, customer, orderHistory, clientelingNotes] =
      await Promise.all([
        messagingRepo.findMessages(activeConversation.id),
        messagingRepo.findAttachmentsByConversation(activeConversation.id),
        customerRepo.findById(activeConversation.customerId),
        new OrderRepository(client).findByCustomer(
          activeConversation.customerId,
        ),
        new ClientelingRepository(client).findByCustomer(
          activeConversation.customerId,
        ),
      ]);
    thread = messages;
    activeCustomer = customer;
    orders = orderHistory;
    notes = clientelingNotes;

    const grouped = new Map<
      string,
      { attachment: { id: string; fileName: string }; signedUrl: string }[]
    >();
    for (const entry of attachments) {
      const key = entry.attachment.messageId;
      const existing = grouped.get(key) ?? [];
      existing.push(entry);
      grouped.set(key, existing);
    }
    attachmentsByMessage = grouped;
  }

  return (
    <div className="grid h-[calc(100dvh-10.5rem)] grid-cols-1 gap-0 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-stone-200)] shadow-[var(--shadow-elevated)] lg:h-[calc(100vh-6rem)] lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)_18rem]">
      <div
        className={`border-[var(--color-stone-200)] bg-white lg:border-r ${
          explicitSelection ? "max-lg:hidden" : ""
        }`}
      >
        <div className="border-b border-[var(--color-stone-200)] px-4 py-3 lg:hidden">
          <p className="font-accent text-[10px] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
            Messages
          </p>
          <p className="font-display text-xl text-[var(--color-stone-900)]">
            Messages
          </p>
        </div>
        <ConversationList conversations={listItems} selectedId={activeId} />
      </div>

      <div
        className={`flex flex-col bg-[var(--color-stone-50)] ${
          explicitSelection ? "" : "max-lg:hidden"
        }`}
      >
        {activeConversation ? (
          <>
            <div className="border-b border-[var(--color-stone-200)] bg-white px-5 py-3">
              <div className="flex items-center gap-3">
                <Link
                  href="/messages"
                  className="font-accent text-[10px] uppercase tracking-[0.14em] text-[var(--color-stone-600)] underline-offset-4 hover:underline lg:hidden"
                >
                  ← Messages
                </Link>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-display text-lg text-[var(--color-stone-900)]">
                      {activeCustomer?.fullName ?? "Customer"}
                    </h1>
                    {activeConversation.intent ? (
                      <Badge tone="neutral">
                        {CONVERSATION_INTENT_LABELS[activeConversation.intent]}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-[var(--color-stone-500)]">
                    {activeCustomer?.userId
                      ? "Shared retailer conversation"
                      : "Storefront inquiry — no portal account yet"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {thread.map((msg) => {
                const msgAttachments = attachmentsByMessage.get(msg.id) ?? [];
                return (
                  <div
                    key={msg.id}
                    className={`max-w-[75%] rounded-[var(--radius-md)] px-4 py-3 ${
                      msg.senderType === "staff"
                        ? "ml-auto bg-[var(--color-stone-900)] text-white"
                        : "bg-white"
                    }`}
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
              {thread.length === 0 ? (
                <p className="text-sm text-[var(--color-stone-500)]">
                  No messages yet.
                </p>
              ) : null}
            </div>

            <form
              action={sendMessage}
              className="sticky bottom-20 z-10 flex flex-col gap-2 border-t border-[var(--color-stone-200)] bg-white/95 p-4 backdrop-blur lg:static lg:bottom-auto lg:bg-white lg:backdrop-blur-none"
            >
              <input
                type="hidden"
                name="conversationId"
                value={activeConversation.id}
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <MessageTextarea />
                <Button type="submit" className="sm:self-end">
                  Send
                </Button>
              </div>
              <AttachFileInput />
            </form>
          </>
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-[var(--color-stone-500)]">
            No conversations yet.
          </p>
        )}
      </div>

      <div className="hidden overflow-y-auto border-l border-[var(--color-stone-200)] bg-white p-5 lg:block">
        {activeCustomer ? (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--color-stone-400)]">
                Customer
              </p>
              <p className="mt-1 font-medium text-[var(--color-stone-900)]">
                {activeCustomer.fullName}
              </p>
              <div className="mt-1">
                <LifecycleBadge stage={activeCustomer.lifecycleStage} />
              </div>
              {activeCustomer.email ? (
                <p className="mt-2 text-sm text-[var(--color-stone-600)]">
                  {activeCustomer.email}
                </p>
              ) : null}
              {activeCustomer.phone ? (
                <p className="text-sm text-[var(--color-stone-600)]">
                  {activeCustomer.phone}
                </p>
              ) : null}
              <a
                href={`/customers/${activeCustomer.id}`}
                className="mt-3 inline-block text-sm underline"
              >
                Open full customer card →
              </a>
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-[var(--color-stone-400)]">
                Order history ({orders.length})
              </p>
              {orders.length === 0 ? (
                <p className="text-sm text-[var(--color-stone-500)]">
                  No orders yet.
                </p>
              ) : (
                <Card className="divide-y divide-[var(--color-stone-100)] p-0">
                  {orders.slice(0, 5).map((order) => (
                    <div key={order.id} className="px-3 py-2 text-sm">
                      <p className="font-medium">{order.orderNumber}</p>
                      <p className="text-xs text-[var(--color-stone-500)]">
                        {ORDER_STATUS_LABELS[order.status]} ·{" "}
                        {formatMoney(order.total, "en-US")}
                      </p>
                    </div>
                  ))}
                </Card>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-[var(--color-stone-400)]">
                House notes ({notes.length})
              </p>
              {notes.length === 0 ? (
                <p className="text-sm text-[var(--color-stone-500)]">
                  No notes yet.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {notes.slice(0, 5).map((note) => (
                    <div
                      key={note.id}
                      className="rounded-[var(--radius-sm)] bg-[var(--color-stone-50)] p-2 text-sm"
                    >
                      <p>{note.body}</p>
                      <p className="mt-1 text-xs text-[var(--color-stone-400)]">
                        {note.pinned ? "Pinned · " : ""}
                        {formatDate(note.createdAt, "en-US")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-stone-500)]">
            Select a conversation to see customer context.
          </p>
        )}
      </div>
    </div>
  );
}
