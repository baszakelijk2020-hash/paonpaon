"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import { setCampaignTargetProduct } from "./actions";

interface TargetProductFormProps {
  readonly campaignId: string;
  readonly productId: string;
  readonly isActive: boolean;
}

export function TargetProductForm({
  campaignId,
  productId,
  isActive,
}: TargetProductFormProps) {
  const [state, formAction] = useActionState(setCampaignTargetProduct, {});

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="active" value={isActive ? "false" : "true"} />
      <Button type="submit" size="sm" variant="outline">
        {isActive ? "Remove" : "Include"}
      </Button>
      {state.formError ? (
        <p className="text-sm text-[var(--color-error-500)]">
          {state.formError}
        </p>
      ) : null}
    </form>
  );
}
