"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState, useState } from "react";

import {
  closeSession,
  openSession,
  recordComparison,
  type StoreSessionActionState,
} from "./actions";

const initial: StoreSessionActionState = {};

export interface Option {
  readonly id: string;
  readonly label: string;
}

function Feedback({ state }: { readonly state: StoreSessionActionState }) {
  if (state.formError) {
    return (
      <p role="alert" className="text-sm text-[var(--color-danger-500)]">
        {state.formError}
      </p>
    );
  }
  if (state.notice) {
    return (
      <p role="status" className="text-sm text-[var(--color-stone-500)]">
        {state.notice}
      </p>
    );
  }
  return null;
}

export function OpenSessionForm({
  customers,
}: {
  readonly customers: readonly Option[];
}) {
  const [state, action, pending] = useActionState(openSession, initial);
  return (
    <form
      action={action}
      className="flex flex-col gap-3"
      id="open-session-form"
    >
      <FormField label="Customer (optional)" htmlFor="open-session-customer">
        <Select id="open-session-customer" name="customerId" defaultValue="">
          <option value="">Walk-in, no customer attached</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.label}
            </option>
          ))}
        </Select>
      </FormField>
      <Button type="submit" disabled={pending}>
        Open a session
      </Button>
      <Feedback state={state} />
    </form>
  );
}

/** Records one garment tried during a guided comparison. */
export function RecordComparisonForm({
  sessionId,
}: {
  readonly sessionId: string;
}) {
  const [state, action, pending] = useActionState(recordComparison, initial);
  const [preferred, setPreferred] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="sessionId" value={sessionId} />
      <div className="flex flex-wrap items-end gap-2">
        <FormField label="Construction" htmlFor={`construction-${sessionId}`}>
          <Select
            id={`construction-${sessionId}`}
            name="constructionKind"
            defaultValue="half_canvas"
          >
            <option value="half_canvas">Half canvas</option>
            <option value="full_canvas">Full canvas</option>
            <option value="handmade">Handmade</option>
          </Select>
        </FormField>
        <label className="flex items-center gap-2 text-sm text-[var(--color-stone-700)]">
          <input
            type="checkbox"
            name="customerPreferred"
            value="true"
            checked={preferred}
            onChange={(event) => setPreferred(event.target.checked)}
          />
          Customer preferred this
        </label>
      </div>
      {preferred ? (
        <FormField label="Why" htmlFor={`reason-${sessionId}`}>
          <Input
            id={`reason-${sessionId}`}
            name="notedReason"
            placeholder="e.g., the chest felt softer"
          />
        </FormField>
      ) : null}
      <div>
        <Button type="submit" disabled={pending} size="sm">
          Record comparison
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/** Closes a session — device failure is a normal path, not an error. */
export function CloseSessionForm({
  sessionId,
}: {
  readonly sessionId: string;
}) {
  const [state, action, pending] = useActionState(closeSession, initial);
  const [deviceFailed, setDeviceFailed] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="sessionId" value={sessionId} />
      <FormField
        label="Look the customer approved"
        htmlFor={`look-${sessionId}`}
      >
        <Input
          id={`look-${sessionId}`}
          name="customerApprovedLookRef"
          placeholder="e.g., navy full-canvas two-piece"
        />
      </FormField>
      <label className="flex items-center gap-2 text-sm text-[var(--color-stone-700)]">
        <input
          type="checkbox"
          name="deviceFailed"
          value="true"
          checked={deviceFailed}
          onChange={(event) => setDeviceFailed(event.target.checked)}
        />
        The mirror/display failed
      </label>
      {deviceFailed ? (
        <label className="flex items-center gap-2 text-sm text-[var(--color-stone-700)]">
          <input type="checkbox" name="manualFallbackUsed" value="true" />
          Finished on paper instead
        </label>
      ) : null}
      <FormField label="Outcome note (optional)" htmlFor={`note-${sessionId}`}>
        <Input id={`note-${sessionId}`} name="outcomeNote" />
      </FormField>
      <div>
        <Button type="submit" disabled={pending} size="sm">
          Close session
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}
