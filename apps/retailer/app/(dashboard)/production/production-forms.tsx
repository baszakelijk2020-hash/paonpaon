"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import {
  amendSpec,
  transitionStage,
  type ProductionActionState,
} from "./actions";

const initial: ProductionActionState = {};

const STAGE_MOVES: Record<string, { to: string; label: string }[]> = {
  spec_locked: [{ to: "cutting", label: "Start cutting" }],
  cutting: [{ to: "assembly", label: "Move to assembly" }],
  assembly: [
    { to: "fitting_basted", label: "Send for fitting (basted)" },
    { to: "finishing", label: "Move to finishing" },
  ],
  fitting_basted: [
    { to: "assembly", label: "Back to assembly" },
    { to: "finishing", label: "Move to finishing" },
  ],
  finishing: [{ to: "quality_control", label: "Send to quality control" }],
  quality_control: [
    { to: "ready", label: "Pass — ready" },
    { to: "rework", label: "Fail — needs rework" },
  ],
  rework: [{ to: "assembly", label: "Back to assembly" }],
  ready: [{ to: "dispatched", label: "Dispatch" }],
};

export interface StaffOption {
  readonly id: string;
  readonly fullName: string;
}

export function TransitionStageForm({
  pieceId,
  stage,
  staff,
}: {
  readonly pieceId: string;
  readonly stage: string;
  readonly staff: readonly StaffOption[];
}) {
  const [state, action, pending] = useActionState(transitionStage, initial);
  const moves = STAGE_MOVES[stage] ?? [];
  if (moves.length === 0) return null;

  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="pieceId" value={pieceId} />
      {stage === "quality_control" ? (
        <Select
          name="inspectorStaffId"
          aria-label="Inspector"
          disabled={pending}
        >
          <option value="">Inspector…</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.fullName}
            </option>
          ))}
        </Select>
      ) : null}
      {stage === "quality_control" ? (
        <Input
          name="defectNote"
          type="text"
          aria-label="Defect note (required to fail)"
          placeholder="Defect note (required to fail)"
          disabled={pending}
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {moves.map((move) => (
          <Button
            key={move.to}
            type="submit"
            name="to"
            value={move.to}
            size="sm"
            variant={move.to === "rework" ? "outline" : "primary"}
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

export function AmendSpecForm({
  specId,
  pieceId,
}: {
  readonly specId: string;
  readonly pieceId: string;
}) {
  const [state, action, pending] = useActionState(amendSpec, initial);

  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="specId" value={specId} />
      <input type="hidden" name="pieceId" value={pieceId} />
      <FormField htmlFor={`reason-${pieceId}`} label="Reason for change">
        <Input
          id={`reason-${pieceId}`}
          name="reason"
          type="text"
          disabled={pending}
        />
      </FormField>
      <FormField htmlFor={`cost-${pieceId}`} label="Who absorbs the cost">
        <Select id={`cost-${pieceId}`} name="costDecision" disabled={pending}>
          <option value="">Select…</option>
          <option value="retailer_absorbs">Retailer absorbs</option>
          <option value="customer_pays">Customer pays</option>
          <option value="supplier_credit">Supplier credit</option>
        </Select>
      </FormField>
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Record amendment
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
