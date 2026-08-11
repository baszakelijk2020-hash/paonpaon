"use client";

import type { AdvisorCaptureBundle } from "@paon/database";
import { CUSTOMER_FACT_TYPES } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { useActionState, useState } from "react";

import {
  confirmConversationFact,
  dismissConversationFact,
  proposeConversationFact,
  type ConversationFactActionState,
} from "./actions";

const initialState: ConversationFactActionState = {};

const typeLabel = (value: string) => value.replaceAll("_", " ");

function HiddenContext({
  conversationId,
  messageId,
  bundleId,
}: {
  readonly conversationId: string;
  readonly messageId: string;
  readonly bundleId?: string;
}) {
  return (
    <>
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="messageId" value={messageId} />
      {bundleId ? (
        <input type="hidden" name="bundleId" value={bundleId} />
      ) : null}
    </>
  );
}

function PendingFact({
  bundle,
  conversationId,
  messageId,
}: {
  readonly bundle: AdvisorCaptureBundle;
  readonly conversationId: string;
  readonly messageId: string;
}) {
  const payload = bundle.payload as { factType: string; valueLabel: string };
  const [confirmState, confirmAction, confirming] = useActionState(
    confirmConversationFact,
    initialState,
  );
  const [dismissState, dismissAction, dismissing] = useActionState(
    dismissConversationFact,
    initialState,
  );
  return (
    <div
      data-conversation-fact-bundle={bundle.id}
      className="mt-2 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white p-3 text-[var(--color-stone-900)]"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-stone-600)]">
        Proposed House Memory fact — review required
      </p>
      <p className="mt-1 text-xs italic text-[var(--color-stone-500)]">
        Citation: &ldquo;{bundle.sourceExcerpt}&rdquo;
      </p>
      <form action={confirmAction} className="mt-2 grid gap-2">
        <HiddenContext
          conversationId={conversationId}
          messageId={messageId}
          bundleId={bundle.id}
        />
        <input
          name="summary"
          required
          maxLength={300}
          defaultValue={bundle.summary}
          aria-label="Fact summary"
          className="rounded border border-[var(--color-stone-200)] px-2 py-1 text-sm"
        />
        <div className="flex gap-2">
          <select
            name="factType"
            defaultValue={payload.factType}
            aria-label="Fact type"
            className="min-w-0 rounded border border-[var(--color-stone-200)] px-2 py-1 text-sm"
          >
            {CUSTOMER_FACT_TYPES.map((type) => (
              <option key={type} value={type}>
                {typeLabel(type)}
              </option>
            ))}
          </select>
          <input
            name="valueLabel"
            required
            maxLength={500}
            defaultValue={payload.valueLabel}
            aria-label="Fact value"
            className="min-w-0 flex-1 rounded border border-[var(--color-stone-200)] px-2 py-1 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={confirming || dismissing}>
            {confirming ? "Confirming…" : "Confirm fact"}
          </Button>
          <button
            formAction={dismissAction}
            type="submit"
            disabled={confirming || dismissing}
            className="text-xs underline"
          >
            Dismiss
          </button>
        </div>
      </form>
      {confirmState.formError || dismissState.formError ? (
        <p role="alert" className="mt-2 text-xs text-[var(--color-danger-500)]">
          {confirmState.formError ?? dismissState.formError}
        </p>
      ) : null}
    </div>
  );
}

export function MessageFactProposal({
  conversationId,
  messageId,
  messageBody,
  pendingBundles,
}: {
  readonly conversationId: string;
  readonly messageId: string;
  readonly messageBody: string;
  readonly pendingBundles: readonly AdvisorCaptureBundle[];
}) {
  const [excerpt, setExcerpt] = useState("");
  const [proposalState, proposalAction, proposing] = useActionState(
    proposeConversationFact,
    initialState,
  );
  return (
    <div className="mt-3 border-t border-[var(--color-stone-200)] pt-3">
      <p className="text-xs text-[var(--color-stone-500)]">
        Select literal message text to propose a House Memory fact. The message
        remains the authority.
      </p>
      <form action={proposalAction} className="mt-2 grid gap-2">
        <HiddenContext conversationId={conversationId} messageId={messageId} />
        <textarea
          readOnly
          value={messageBody}
          aria-label="Select exact message excerpt"
          onSelect={(event) => {
            const input = event.currentTarget;
            setExcerpt(
              input.value.slice(input.selectionStart, input.selectionEnd),
            );
          }}
          className="min-h-16 w-full resize-y rounded border border-[var(--color-stone-200)] bg-[var(--color-stone-50)] p-2 text-xs"
        />
        <input type="hidden" name="sourceExcerpt" value={excerpt} />
        <p className="text-xs text-[var(--color-stone-500)]">
          {excerpt
            ? `Selected: “${excerpt}”`
            : "Select an exact excerpt above."}
        </p>
        <input
          name="summary"
          required
          maxLength={300}
          placeholder="What should this fact say?"
          aria-label="Proposed fact summary"
          className="rounded border border-[var(--color-stone-200)] px-2 py-1 text-sm"
        />
        <div className="flex gap-2">
          <select
            name="factType"
            aria-label="Proposed fact type"
            className="rounded border border-[var(--color-stone-200)] px-2 py-1 text-sm"
          >
            {CUSTOMER_FACT_TYPES.map((type) => (
              <option key={type} value={type}>
                {typeLabel(type)}
              </option>
            ))}
          </select>
          <input
            name="valueLabel"
            required
            maxLength={500}
            placeholder="Fact value"
            aria-label="Proposed fact value"
            className="min-w-0 flex-1 rounded border border-[var(--color-stone-200)] px-2 py-1 text-sm"
          />
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={proposing || !excerpt}
          className="justify-self-start"
        >
          {proposing ? "Creating…" : "Create fact proposal"}
        </Button>
      </form>
      {proposalState.formError ? (
        <p role="alert" className="mt-2 text-xs text-[var(--color-danger-500)]">
          {proposalState.formError}
        </p>
      ) : null}
      {pendingBundles.map((bundle) => (
        <PendingFact
          key={bundle.id}
          bundle={bundle}
          conversationId={conversationId}
          messageId={messageId}
        />
      ))}
    </div>
  );
}
