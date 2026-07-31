"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import { runShopifySync, type ShopifySyncActionState } from "./actions";

const initial: ShopifySyncActionState = {};

/** Manual Shopify delta-sync trigger (PHASE 9.2) for one connection. */
export function ShopifySyncButton({
  connectionId,
}: {
  readonly connectionId: string;
}) {
  const [state, action, pending] = useActionState(runShopifySync, initial);

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action}>
        <input type="hidden" name="connectionId" value={connectionId} />
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? "Syncing…" : "Run Shopify sync"}
        </Button>
      </form>
      {state.formError ? (
        <p className="text-xs text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.lastRunSummary ? (
        <p className="text-xs text-[var(--color-stone-500)]">
          {state.lastRunSummary}
        </p>
      ) : null}
    </div>
  );
}
