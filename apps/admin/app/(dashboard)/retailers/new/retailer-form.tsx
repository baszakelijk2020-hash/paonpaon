"use client";

import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import { createRetailer, initialCreateRetailerFormState } from "./actions";

export function RetailerForm() {
  const [state, formAction, isPending] = useActionState(
    createRetailer,
    initialCreateRetailerFormState,
  );
  const v = state.values;

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {state.formError ? (
        <p
          role="alert"
          className="bg-[var(--color-danger-500)]/10 rounded-[var(--radius-sm)] px-4 py-3 text-sm text-[var(--color-danger-500)]"
        >
          {state.formError}
        </p>
      ) : null}

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Retailer
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Legal name"
            htmlFor="legalName"
            error={state.fieldErrors["legalName"]}
          >
            <Input
              id="legalName"
              name="legalName"
              defaultValue={v["legalName"]}
              invalid={!!state.fieldErrors["legalName"]}
              required
            />
          </FormField>
          <FormField
            label="Display name"
            htmlFor="displayName"
            error={state.fieldErrors["displayName"]}
          >
            <Input
              id="displayName"
              name="displayName"
              defaultValue={v["displayName"]}
              invalid={!!state.fieldErrors["displayName"]}
              required
            />
          </FormField>
          <FormField
            label="Slug"
            htmlFor="slug"
            hint="Lowercase letters, numbers and hyphens"
            error={state.fieldErrors["slug"]}
          >
            <Input
              id="slug"
              name="slug"
              defaultValue={v["slug"]}
              invalid={!!state.fieldErrors["slug"]}
              required
            />
          </FormField>
          <FormField
            label="Tier"
            htmlFor="tier"
            error={state.fieldErrors["tier"]}
          >
            <Select
              id="tier"
              name="tier"
              defaultValue={v["tier"] ?? "boutique"}
            >
              <option value="boutique">Boutique</option>
              <option value="house">House</option>
              <option value="maison">Maison</option>
            </Select>
          </FormField>
          <FormField
            label="Default currency"
            htmlFor="defaultCurrency"
            error={state.fieldErrors["defaultCurrency"]}
          >
            <Select
              id="defaultCurrency"
              name="defaultCurrency"
              defaultValue={v["defaultCurrency"] ?? "USD"}
            >
              {["USD", "EUR", "GBP", "CHF", "JPY", "AED", "HKD", "SGD"].map(
                (code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ),
              )}
            </Select>
          </FormField>
          <FormField
            label="Default locale"
            htmlFor="defaultLocale"
            error={state.fieldErrors["defaultLocale"]}
          >
            <Input
              id="defaultLocale"
              name="defaultLocale"
              defaultValue={v["defaultLocale"] ?? "en-US"}
              required
            />
          </FormField>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Billing address
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Address line 1"
            htmlFor="billingLine1"
            error={state.fieldErrors["billingAddress.line1"]}
          >
            <Input
              id="billingLine1"
              name="billingLine1"
              defaultValue={v["billingLine1"]}
              required
            />
          </FormField>
          <FormField label="Address line 2" htmlFor="billingLine2">
            <Input
              id="billingLine2"
              name="billingLine2"
              defaultValue={v["billingLine2"]}
            />
          </FormField>
          <FormField
            label="City"
            htmlFor="billingCity"
            error={state.fieldErrors["billingAddress.city"]}
          >
            <Input
              id="billingCity"
              name="billingCity"
              defaultValue={v["billingCity"]}
              required
            />
          </FormField>
          <FormField label="Region / state" htmlFor="billingRegion">
            <Input
              id="billingRegion"
              name="billingRegion"
              defaultValue={v["billingRegion"]}
            />
          </FormField>
          <FormField
            label="Postal code"
            htmlFor="billingPostalCode"
            error={state.fieldErrors["billingAddress.postalCode"]}
          >
            <Input
              id="billingPostalCode"
              name="billingPostalCode"
              defaultValue={v["billingPostalCode"]}
              required
            />
          </FormField>
          <FormField
            label="Country code"
            htmlFor="billingCountryCode"
            hint="2-letter ISO code, e.g. US"
            error={state.fieldErrors["billingAddress.countryCode"]}
          >
            <Input
              id="billingCountryCode"
              name="billingCountryCode"
              maxLength={2}
              defaultValue={v["billingCountryCode"]}
              required
            />
          </FormField>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Owner
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          They&rsquo;ll receive an email invite to set a password and sign in to
          the Retailer Portal as the retailer&rsquo;s owner.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Full name"
            htmlFor="ownerFullName"
            error={state.fieldErrors["ownerFullName"]}
          >
            <Input
              id="ownerFullName"
              name="ownerFullName"
              defaultValue={v["ownerFullName"]}
              required
            />
          </FormField>
          <FormField
            label="Email"
            htmlFor="ownerEmail"
            error={state.fieldErrors["ownerEmail"]}
          >
            <Input
              id="ownerEmail"
              name="ownerEmail"
              type="email"
              defaultValue={v["ownerEmail"]}
              required
            />
          </FormField>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create retailer & send invite"}
        </Button>
      </div>
    </form>
  );
}
