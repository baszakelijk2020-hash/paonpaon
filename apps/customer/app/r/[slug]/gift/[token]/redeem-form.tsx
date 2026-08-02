"use client";

import type { GiftRevealItem } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Input } from "@paon/ui/components/Input";
import { formatMoney } from "@paon/utils";
import { useActionState, useState } from "react";

import { redeemGift, type RedeemGiftState } from "./actions";

const initialState: RedeemGiftState = {};

export function RedeemForm({
  slug,
  token,
  items,
}: {
  slug: string;
  token: string;
  items: readonly GiftRevealItem[];
}) {
  const boundAction = redeemGift.bind(null, slug, token);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialState,
  );
  const [selectedId, setSelectedId] = useState(items[0]?.curatedItemId ?? "");

  if (state.redeemed) {
    return (
      <p className="text-sm text-[var(--color-stone-700)]" role="status">
        Thank you — we&rsquo;ve let the atelier know. They&rsquo;ll be in touch
        about your piece.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="curatedItemId" value={selectedId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">
          Choose the piece you&rsquo;d like
        </legend>
        {items.map((item) => (
          <label
            key={item.curatedItemId}
            className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3"
          >
            <input
              type="radio"
              checked={selectedId === item.curatedItemId}
              onChange={() => setSelectedId(item.curatedItemId)}
            />
            <span className="flex-1">
              <span className="block font-medium">{item.productName}</span>
              {item.variantLabel ? (
                <span className="block text-sm text-[var(--color-stone-500)]">
                  {item.variantLabel}
                </span>
              ) : null}
            </span>
            <span className="text-sm">{formatMoney(item.price, "en-US")}</span>
          </label>
        ))}
      </fieldset>
      <Input name="recipientName" placeholder="Your name" required />
      <Input
        name="recipientEmail"
        type="email"
        placeholder="Your email"
        required
      />
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending || !selectedId}>
        {isPending ? "Choosing…" : "Choose this piece"}
      </Button>
    </form>
  );
}
