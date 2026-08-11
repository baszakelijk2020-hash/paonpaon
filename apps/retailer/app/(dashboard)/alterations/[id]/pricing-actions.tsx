"use client";

import type {
  AlterationAttachment,
  AlterationTask,
  PriceChangeProposal,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import {
  decidePriceChange,
  proposePriceChange,
  recordTaskCostAllocation,
} from "./actions";

export function PriceProposalForm({
  alterationId,
  tasks,
  evidence,
}: {
  alterationId: string;
  tasks: readonly AlterationTask[];
  evidence: readonly AlterationAttachment[];
}) {
  const [state, action, pending] = useActionState(
    proposePriceChange.bind(null, alterationId),
    {},
  );
  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Select name="taskId" aria-label="Task">
        <option value="">Whole work order</option>
        {tasks
          .filter((task) => task.classification === "work_now")
          .map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
      </Select>
      <Input
        name="proposedAmount"
        type="number"
        min="0"
        step="0.01"
        placeholder="Proposed amount"
        required
      />
      <Input
        name="explanation"
        className="sm:col-span-2"
        placeholder="Explain why the price should increase or decrease"
        minLength={10}
        required
      />
      <Select name="evidenceAttachmentId" aria-label="Evidence image">
        <option value="">No evidence image</option>
        {evidence.map((attachment) => (
          <option key={attachment.id} value={attachment.id}>
            {attachment.kind} · {attachment.fileName}
          </option>
        ))}
      </Select>
      <Button type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit price proposal"}
      </Button>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
    </form>
  );
}

/** Internal labour/material/partner cost breakdown behind a task's agreed
 * price — never shown to the customer. Management-only, mirroring
 * `PriceDecisionForm`'s own permission boundary. */
export function CostAllocationForm({
  alterationId,
  task,
  currency,
}: {
  alterationId: string;
  task: AlterationTask;
  currency: string;
}) {
  const [state, action, pending] = useActionState(
    recordTaskCostAllocation.bind(null, task.id, alterationId),
    {},
  );
  return (
    <form
      action={action}
      className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      <Input
        name="labourCost"
        type="number"
        min="0"
        step="0.01"
        placeholder="Labour"
        aria-label={`${task.title} labour cost`}
        defaultValue={
          task.costAllocation
            ? task.costAllocation.labourCost.amountMinorUnits / 100
            : undefined
        }
        required
      />
      <Input
        name="materialCost"
        type="number"
        min="0"
        step="0.01"
        placeholder="Material"
        aria-label={`${task.title} material cost`}
        defaultValue={
          task.costAllocation
            ? task.costAllocation.materialCost.amountMinorUnits / 100
            : undefined
        }
        required
      />
      <Input
        name="partnerCost"
        type="number"
        min="0"
        step="0.01"
        placeholder="Partner"
        aria-label={`${task.title} partner cost`}
        defaultValue={
          task.costAllocation
            ? task.costAllocation.partnerCost.amountMinorUnits / 100
            : undefined
        }
        required
      />
      <input type="hidden" name="currency" value={currency} />
      <Input
        name="reason"
        className="col-span-2 sm:col-span-4"
        placeholder="Reason (e.g. workshop invoice reference)"
        aria-label={`${task.title} cost allocation reason`}
        minLength={3}
        required
      />
      <Button
        type="submit"
        size="sm"
        disabled={pending}
        className="col-span-2 sm:col-span-4"
      >
        {pending ? "Saving…" : "Record cost allocation"}
      </Button>
      {state.formError ? (
        <p
          role="alert"
          className="col-span-2 text-sm text-[var(--color-danger-500)] sm:col-span-4"
        >
          {state.formError}
        </p>
      ) : null}
    </form>
  );
}

export function PriceDecisionForm({
  alterationId,
  proposal,
}: {
  alterationId: string;
  proposal: PriceChangeProposal;
}) {
  const [state, action, pending] = useActionState(
    decidePriceChange.bind(null, proposal.id, alterationId),
    {},
  );
  return (
    <form action={action} className="mt-3 flex flex-wrap gap-2">
      <Select name="decision" aria-label="Decision">
        <option value="approved">Approve</option>
        <option value="rejected">Reject</option>
      </Select>
      <Input
        name="reason"
        className="min-w-56 flex-1"
        placeholder="Decision reason"
        minLength={3}
        required
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Record decision"}
      </Button>
      {state.formError ? (
        <p
          role="alert"
          className="w-full text-sm text-[var(--color-danger-500)]"
        >
          {state.formError}
        </p>
      ) : null}
    </form>
  );
}
