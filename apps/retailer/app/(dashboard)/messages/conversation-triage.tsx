"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import {
  approveConversationDraft,
  claimConversation,
  dismissConversationDraft,
  generateConversationDraft,
  type ConversationDraftActionState,
} from "./actions";

export function ConversationTriage({
  conversationId,
  claimedByName,
  statusLabel,
  buyingIntentLevel,
  buyingIntentSignals,
  draft,
}: {
  conversationId: string;
  claimedByName: string | null;
  statusLabel: string;
  buyingIntentLevel: string | null;
  buyingIntentSignals: readonly {
    readonly label: string;
    readonly matchedText: string;
  }[];
  draft: { readonly id: string; readonly draftText: string } | null;
}) {
  const generate = generateConversationDraft.bind(null, conversationId);
  const [generationState, generateAction, pending] = useActionState<
    ConversationDraftActionState,
    FormData
  >(generate, {});

  return (
    <section
      aria-label="Conversation triage"
      className="border-b border-[var(--color-stone-200)] bg-[var(--color-stone-50)] px-5 py-3"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-stone-600)]">
        <span className="rounded-[var(--radius-md)] bg-white px-2.5 py-1 font-medium">
          {statusLabel}
        </span>
        {buyingIntentLevel ? (
          <span className="capitalize">
            {buyingIntentLevel.replace("_", " ")} intent
          </span>
        ) : null}
        {claimedByName ? <span>Assigned to {claimedByName}</span> : null}
      </div>
      {buyingIntentSignals.length > 0 ? (
        <p className="mt-2 text-xs text-[var(--color-stone-500)]">
          {buyingIntentSignals
            .map((signal) => `${signal.label}: “${signal.matchedText}”`)
            .join(" · ")}
        </p>
      ) : null}

      {!claimedByName ? (
        <form action={claimConversation} className="mt-3">
          <input type="hidden" name="conversationId" value={conversationId} />
          <Button type="submit" size="sm">
            Claim conversation
          </Button>
        </form>
      ) : draft ? (
        <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-stone-600)]">
            AI-proposed reply — never sent automatically
          </p>
          <form action={approveConversationDraft} className="mt-2 space-y-2">
            <input type="hidden" name="draftId" value={draft.id} />
            <textarea
              name="draftText"
              required
              maxLength={5000}
              defaultValue={draft.draftText}
              aria-label="AI draft reply"
              className="min-h-24 w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-stone-900)]"
            />
            <Button type="submit" size="sm">
              Review/edit then send
            </Button>
          </form>
          <form action={dismissConversationDraft} className="mt-2">
            <input type="hidden" name="draftId" value={draft.id} />
            <Button type="submit" size="sm" variant="ghost">
              Dismiss draft
            </Button>
          </form>
        </div>
      ) : (
        <form action={generateAction} className="mt-3">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Generating grounded draft…" : "Generate grounded draft"}
          </Button>
          {generationState.formError ? (
            <p
              role="alert"
              className="mt-2 text-xs text-[var(--color-danger-500)]"
            >
              {generationState.formError}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
