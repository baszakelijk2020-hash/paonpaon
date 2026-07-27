"use client";

import { Badge } from "@paon/ui/components/Badge";
import { formatDate } from "@paon/utils";
import Link from "next/link";
import { useMemo, useState } from "react";

export interface ConversationListItem {
  id: string;
  customerName: string;
  intentLabel: string | null;
  lastMessageAt: string | null;
  preview: string;
  awaitingReply: boolean;
}

const STATUS_FILTERS = ["all", "awaiting", "replied"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

/**
 * Left pane of the 3-pane inbox. Filtering/search runs client-side over
 * the already-fetched conversation list (small enough per retailer that
 * a round-trip per keystroke would be pure overhead) — status here is
 * derived from real data (who sent the last message), not a fabricated
 * ticket-status column the schema doesn't have.
 */
export function ConversationList({
  conversations,
  selectedId,
}: {
  conversations: ConversationListItem[];
  selectedId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((item) => {
      if (status === "awaiting" && !item.awaitingReply) return false;
      if (status === "replied" && item.awaitingReply) return false;
      if (!q) return true;
      return (
        item.customerName.toLowerCase().includes(q) ||
        item.preview.toLowerCase().includes(q) ||
        (item.intentLabel?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [conversations, query, status]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--color-stone-200)] p-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search conversations…"
          aria-label="Search conversations"
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-stone-300)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink-600)]"
        />
        <div
          className="mt-2 flex gap-1"
          role="tablist"
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={status === value}
              onClick={() => setStatus(value)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                status === value
                  ? "bg-[var(--color-stone-900)] text-white"
                  : "text-[var(--color-stone-500)] hover:bg-[var(--color-stone-100)]"
              }`}
            >
              {value === "awaiting" ? "Awaiting reply" : value}
            </button>
          ))}
        </div>
      </div>
      <ul className="flex-1 overflow-y-auto" aria-label="Conversations">
        {filtered.length === 0 ? (
          <li className="p-6 text-sm text-[var(--color-stone-500)]">
            No conversations match.
          </li>
        ) : null}
        {filtered.map((item) => (
          <li key={item.id}>
            <Link
              href={`/messages?c=${item.id}`}
              aria-current={selectedId === item.id ? "true" : undefined}
              className={`flex flex-col gap-1 border-b border-[var(--color-stone-100)] px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-ink-600)] ${
                selectedId === item.id
                  ? "bg-[var(--color-stone-100)]"
                  : "hover:bg-[var(--color-stone-50)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-[var(--color-stone-900)]">
                  {item.customerName}
                </span>
                {item.awaitingReply ? (
                  <Badge tone="warning">Awaiting reply</Badge>
                ) : null}
              </div>
              <p className="truncate text-sm text-[var(--color-stone-500)]">
                {item.preview}
              </p>
              <div className="flex items-center gap-2 text-xs text-[var(--color-stone-400)]">
                {item.intentLabel ? <span>{item.intentLabel}</span> : null}
                {item.lastMessageAt ? (
                  <span>{formatDate(item.lastMessageAt, "en-US")}</span>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
