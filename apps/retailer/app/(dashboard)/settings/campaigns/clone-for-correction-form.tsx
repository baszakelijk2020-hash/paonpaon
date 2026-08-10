"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import { cloneCampaignForCorrection } from "./actions";

interface CloneForCorrectionFormProps {
  readonly campaignId: string;
}

export function CloneForCorrectionForm({
  campaignId,
}: CloneForCorrectionFormProps) {
  const [state, formAction] = useActionState(
    cloneCampaignForCorrection as unknown as (
      state: unknown,
      formData: FormData,
    ) => Promise<unknown>,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="campaignId" value={campaignId} />
      <Button type="submit" size="sm" variant="outline">
        Clone for correction
      </Button>
      {(state as unknown as { formError?: string }).formError ? (
        <p className="text-sm text-[var(--color-error-500)]">
          {(state as unknown as { formError?: string }).formError}
        </p>
      ) : null}
    </form>
  );
}
