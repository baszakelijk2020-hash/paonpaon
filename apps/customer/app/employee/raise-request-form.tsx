"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Select } from "@paon/ui/components/Select";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";

import {
  raiseServiceRequest,
  type RaiseServiceRequestFormState,
} from "./actions";
import { WEARER_RAISABLE_EXCEPTION_KINDS } from "./service-request-kinds";

const KIND_LABELS: Record<string, string> = {
  damaged: "Damaged",
  missing: "Missing",
  fit_issue: "Fit issue",
  alteration_request: "Alteration request",
  replacement_request: "Replacement request",
};

const initialState: RaiseServiceRequestFormState = { submitted: false };

export function RaiseRequestForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    raiseServiceRequest,
    initialState,
  );

  // revalidatePath alone does not reliably repaint this list client-side
  // (same class of issue advisor-capture.tsx's BundleCard already works
  // around) — explicitly refresh once a submission settles without error.
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !isPending && !state.formError) {
      router.refresh();
    }
    wasPending.current = isPending;
  }, [isPending, state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormField label="What's the problem?" htmlFor="kind">
        <Select id="kind" name="kind" required defaultValue="fit_issue">
          {WEARER_RAISABLE_EXCEPTION_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {KIND_LABELS[kind] ?? kind}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Details" htmlFor="detail">
        <textarea
          id="detail"
          name="detail"
          required
          minLength={5}
          maxLength={2000}
          className="min-h-20 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3 text-sm"
        />
      </FormField>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Sending…" : "Send to my advisor"}
      </Button>
    </form>
  );
}
