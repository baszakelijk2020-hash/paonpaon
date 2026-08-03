"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState, useState } from "react";

import { saveDefaultShippingAddress } from "./one-tap-actions";

/**
 * The "accomplishment" framing is deliberate: most customers have never
 * been asked to save a default address, so this is a real gap, not a
 * theoretical one. Shown when `customers.shipping_addresses` is empty;
 * once saved, `OneTapCheckoutEnabledBadge` below replaces it. No payment
 * method is collected here — 1-Tap Checkout means skipping the manual
 * address form, not a live card charge (checkout has never captured
 * payment in this storefront; that stays gated on a real processor
 * decision).
 */
export function OneTapCheckoutBanner({ retailerId }: { retailerId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    saveDefaultShippingAddress.bind(null, retailerId),
    {},
  );

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--color-danger-500)] px-4 py-3">
        <div>
          <p className="text-sm font-medium text-[var(--color-stone-900)]">
            1-Tap Checkout is not turned on.
          </p>
          <p className="text-xs text-[var(--color-stone-600)]">
            Save a default address once, then buy today&rsquo;s pick with a
            single tap.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          Turn it on
        </Button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white p-4"
    >
      <p className="text-sm font-medium text-[var(--color-stone-900)]">
        Save your default address for 1-Tap Checkout
      </p>
      {state.formError ? (
        <p role="alert" className="text-xs text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          name="line1"
          aria-label="Address line 1"
          placeholder="Address line 1"
          required
          className="h-9 rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 text-sm sm:col-span-2"
        />
        <input
          name="line2"
          aria-label="Address line 2"
          placeholder="Address line 2 (optional)"
          className="h-9 rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 text-sm sm:col-span-2"
        />
        <input
          name="city"
          aria-label="City"
          placeholder="City"
          required
          className="h-9 rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 text-sm"
        />
        <input
          name="region"
          aria-label="Region"
          placeholder="Region (optional)"
          className="h-9 rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 text-sm"
        />
        <input
          name="postalCode"
          aria-label="Postal code"
          placeholder="Postal code"
          required
          className="h-9 rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 text-sm"
        />
        <input
          name="countryCode"
          aria-label="Country code"
          placeholder="Country code (e.g. US)"
          maxLength={2}
          required
          className="h-9 rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save & turn on"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function OneTapCheckoutEnabledBadge() {
  return (
    <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-success-500)] px-4 py-2 text-sm text-[var(--color-stone-900)]">
      <span aria-hidden="true" className="text-[var(--color-success-500)]">
        ✓
      </span>
      1-Tap Checkout is on — buy today&rsquo;s pick in one tap.
    </div>
  );
}
