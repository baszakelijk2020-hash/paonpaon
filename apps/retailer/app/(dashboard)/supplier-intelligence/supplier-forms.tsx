"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import {
  createException,
  resolveException,
  transitionComplaint,
  type SupplierActionState,
} from "./actions";

const initial: SupplierActionState = {};

export interface FactOption {
  readonly id: string;
  readonly materialKey: string;
  readonly kind: string;
  readonly value: string;
  readonly sourceAuthorityKey: string;
}

export interface StaffOption {
  readonly id: string;
  readonly fullName: string;
}

export function CreateExceptionForm({
  facts,
  staff,
}: {
  readonly facts: readonly FactOption[];
  readonly staff: readonly StaffOption[];
}) {
  const [state, action, pending] = useActionState(createException, initial);

  return (
    <form action={action} className="mt-3 flex flex-col gap-4">
      <FormField htmlFor="exceptionKind" label="Kind">
        <Select id="exceptionKind" name="kind" required disabled={pending}>
          <option value="order_overdue">Order overdue</option>
          <option value="material_shortage">Material shortage</option>
          <option value="material_discontinued">Material discontinued</option>
          <option value="lead_time_increased">Lead time increased</option>
        </Select>
      </FormField>

      <FormField htmlFor="exceptionMaterialKey" label="Material key">
        <Input
          id="exceptionMaterialKey"
          name="materialKey"
          type="text"
          required
          disabled={pending}
        />
      </FormField>

      <FormField htmlFor="ownerStaffId" label="Owner">
        <Select
          id="ownerStaffId"
          name="ownerStaffId"
          required
          disabled={pending}
        >
          <option value="">Select…</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.fullName}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField htmlFor="detail" label="Detail">
        <textarea
          id="detail"
          name="detail"
          required
          minLength={10}
          maxLength={4000}
          rows={3}
          disabled={pending}
          className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-stone-400)]"
        />
      </FormField>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-[var(--color-stone-800)]">
          Cite the facts behind this
        </legend>
        {facts.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            No supplier facts logged yet.
          </p>
        ) : (
          facts.map((fact) => (
            <label
              key={fact.id}
              className="flex items-center gap-2 text-sm text-[var(--color-stone-700)]"
            >
              <input
                type="checkbox"
                name="citationFactIds"
                value={fact.id}
                disabled={pending}
                className="h-4 w-4 rounded border border-[var(--color-stone-300)] accent-[var(--color-stone-900)]"
              />
              {fact.materialKey} — {fact.kind} = {fact.value} (
              {fact.sourceAuthorityKey})
            </label>
          ))
        )}
      </fieldset>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Recording…" : "Record exception"}
        </Button>
      </div>

      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" className="text-sm text-[var(--color-stone-500)]">
          {state.notice}
        </p>
      ) : null}
    </form>
  );
}

export function ResolveExceptionForm({
  exceptionId,
}: {
  readonly exceptionId: string;
}) {
  const [state, action, pending] = useActionState(resolveException, initial);

  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="exceptionId" value={exceptionId} />
      <Input
        name="resolutionNote"
        type="text"
        aria-label="How was this resolved?"
        placeholder="How was this resolved?"
        disabled={pending}
      />
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          Resolve
        </Button>
      </div>
      {state.formError ? (
        <p role="alert" className="text-xs text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" className="text-xs text-[var(--color-stone-500)]">
          {state.notice}
        </p>
      ) : null}
    </form>
  );
}

const COMPLAINT_MOVES: Record<string, { to: string; label: string }[]> = {
  raised: [{ to: "investigating", label: "Start investigating" }],
  investigating: [
    { to: "supplier_notified", label: "Notify supplier" },
    { to: "customer_recovered", label: "Mark customer recovered" },
  ],
  supplier_notified: [
    { to: "customer_recovered", label: "Mark customer recovered" },
  ],
  customer_recovered: [{ to: "closed", label: "Close case" }],
};

export function TransitionComplaintForm({
  complaintId,
  state: currentState,
}: {
  readonly complaintId: string;
  readonly state: string;
}) {
  const [state, action, pending] = useActionState(transitionComplaint, initial);
  const moves = COMPLAINT_MOVES[currentState] ?? [];
  if (moves.length === 0) return null;

  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="complaintId" value={complaintId} />
      <Input
        name="evidenceRefs"
        type="text"
        aria-label="Evidence refs, comma separated"
        placeholder="Evidence refs, comma separated (required to notify supplier)"
        disabled={pending}
      />
      <Input
        name="customerRecoveryNote"
        type="text"
        aria-label="Customer recovery note"
        placeholder="Customer recovery note (required to mark recovered)"
        disabled={pending}
      />
      <Input
        name="supplierActionNote"
        type="text"
        aria-label="Supplier action note"
        placeholder="Supplier action note (optional)"
        disabled={pending}
      />
      <Input
        name="outcomeNote"
        type="text"
        aria-label="Final outcome"
        placeholder="Final outcome (required to close)"
        disabled={pending}
      />
      <div className="flex flex-wrap gap-2">
        {moves.map((move) => (
          <Button
            key={move.to}
            type="submit"
            name="to"
            value={move.to}
            size="sm"
            variant={move.to === "closed" ? "primary" : "outline"}
            disabled={pending}
          >
            {move.label}
          </Button>
        ))}
      </div>
      {state.formError ? (
        <p role="alert" className="text-xs text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" className="text-xs text-[var(--color-stone-500)]">
          {state.notice}
        </p>
      ) : null}
    </form>
  );
}
