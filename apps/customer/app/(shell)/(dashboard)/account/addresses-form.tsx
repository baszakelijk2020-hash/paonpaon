"use client";

import type { Address, Customer } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { useActionState } from "react";

import { saveAddress, type AddressFormState } from "./actions";
import { AddressSearchFields } from "./address-search-fields";

interface AddressesFormProps {
  retailerId: string;
  customer: Customer;
}

function AddressSection({
  label,
  initialAddress,
  retailerId,
}: {
  label: "home" | "work";
  initialAddress: Address | undefined;
  retailerId: string;
}) {
  const initialState: AddressFormState = {
    fieldErrors: {},
  };

  const boundSaveAddress = saveAddress.bind(null, label);
  const [state, formAction, isPending] = useActionState(
    boundSaveAddress,
    initialState,
  );

  const displayLabel = label.charAt(0).toUpperCase() + label.slice(1);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <h3 className="mb-4 text-base font-semibold text-white">
        {displayLabel}
      </h3>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="retailerId" value={retailerId} />
        <input type="hidden" name="countryCode" value="NL" />

        {state.formError ? (
          <p role="alert" className="text-sm text-[#ff6b6b]">
            {state.formError}
          </p>
        ) : null}
        {state.success ? (
          <p role="status" className="text-sm text-[#90ee90]">
            {displayLabel} address saved.
          </p>
        ) : null}

        <AddressSearchFields initialAddress={initialAddress} label={label} />

        {/* Floor/unit (optional) */}
        <FormField
          label="Floor or unit (optional)"
          htmlFor={`floor-${label}-${retailerId}`}
          error={state.fieldErrors["floor"]}
        >
          <Input
            id={`floor-${label}-${retailerId}`}
            name="floor"
            type="text"
            defaultValue={initialAddress?.floor ?? ""}
            placeholder="e.g., 3B or Apt 301"
            className="bg-white/10 text-white placeholder:text-white/40 focus:bg-white/20"
          />
        </FormField>

        {/* Delivery notes (optional) */}
        <FormField
          label="Delivery notes (optional)"
          htmlFor={`deliveryNotes-${label}-${retailerId}`}
          error={state.fieldErrors["deliveryNotes"]}
          hint="e.g., Leave with reception, ask for concierge"
        >
          <textarea
            id={`deliveryNotes-${label}-${retailerId}`}
            name="deliveryNotes"
            defaultValue={initialAddress?.deliveryNotes ?? ""}
            placeholder="e.g., Leave with reception, ask for concierge"
            rows={3}
            className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white transition-colors duration-150 placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          />
        </FormField>

        {/* Submit button */}
        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isPending} size="sm">
            {isPending ? "Saving…" : `Save ${displayLabel}`}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function AddressesForm({ retailerId, customer }: AddressesFormProps) {
  const homeAddress = customer.shippingAddresses.find(
    (a) => a.label === "home",
  );
  const workAddress = customer.shippingAddresses.find(
    (a) => a.label === "work",
  );

  return (
    <section
      className="pe-card rounded-[32px] bg-[#191b1d] p-7 text-white"
      data-pe-card
    >
      <p className="customer-kicker text-white/55">Delivery locations</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
        Addresses
      </h2>
      <p className="mt-2 max-w-xl text-sm text-white/60">
        Save your home and work addresses for faster checkout and delivery
        management.
      </p>

      <div className="mt-6 flex flex-col gap-5">
        <AddressSection
          label="home"
          initialAddress={homeAddress}
          retailerId={retailerId}
        />
        <AddressSection
          label="work"
          initialAddress={workAddress}
          retailerId={retailerId}
        />
      </div>
    </section>
  );
}
