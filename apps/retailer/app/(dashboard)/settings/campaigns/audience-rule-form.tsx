"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import { upsertCampaignAudienceRule } from "./actions";

interface AudienceRuleFormProps {
  readonly campaignId: string;
}

export function AudienceRuleForm({ campaignId }: AudienceRuleFormProps) {
  const [state, formAction] = useActionState(
    upsertCampaignAudienceRule as unknown as (
      state: unknown,
      formData: FormData,
    ) => Promise<unknown>,
    {},
  );

  return (
    <form action={formAction} className="mt-3 grid gap-2 md:grid-cols-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <select
        name="ruleKind"
        className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
        defaultValue="personalization_consent"
      >
        <option value="personalization_consent">Personalization consent</option>
        <option value="fabric_concept">Fabric concept</option>
        <option value="category_concept">Category concept</option>
        <option value="style_preference">Style preference</option>
        <option value="loyalty_tier">Loyalty tier</option>
      </select>
      <input
        name="conceptId"
        placeholder="Concept UUID (optional)"
        className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
      />
      <input
        name="explanation"
        required
        placeholder="Why this member sees it"
        className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm md:col-span-2"
      />
      <Button type="submit" size="sm" variant="outline">
        Add rule
      </Button>
      {(state as unknown as { formError?: string }).formError ? (
        <p className="col-span-full text-sm text-[var(--color-error-500)]">
          {(state as unknown as { formError?: string }).formError}
        </p>
      ) : null}
    </form>
  );
}
