"use client";

import type { Retailer } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { useActionState } from "react";

import { updateRetailerProfile } from "./actions";

export function SettingsForm({ retailer }: { retailer: Retailer }) {
  const [state, formAction, isPending] = useActionState(updateRetailerProfile, {
    fieldErrors: {},
    values: {
      legalName: retailer.legalName,
      displayName: retailer.displayName,
      primaryDomain: retailer.primaryDomain ?? "",
      defaultLocale: retailer.defaultLocale,
      billingLine1: retailer.billingAddress.line1,
      billingLine2: retailer.billingAddress.line2 ?? "",
      billingCity: retailer.billingAddress.city,
      billingRegion: retailer.billingAddress.region ?? "",
      billingPostalCode: retailer.billingAddress.postalCode,
      billingCountryCode: retailer.billingAddress.countryCode,
    },
  });
  const v = state.values;

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {state.formError ? (
        <p
          role="alert"
          className="bg-[var(--color-danger-500)]/10 rounded-[var(--radius-md)] px-4 py-3 text-sm text-[var(--color-danger-500)]"
        >
          {state.formError}
        </p>
      ) : null}
      {state.success ? (
        <p
          role="status"
          className="bg-[var(--color-success-500)]/10 rounded-[var(--radius-md)] px-4 py-3 text-sm text-[var(--color-success-500)]"
        >
          Settings saved.
        </p>
      ) : null}

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Business profile
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
            label="Primary domain"
            htmlFor="primaryDomain"
            hint="Optional"
            error={state.fieldErrors["primaryDomain"]}
          >
            <Input
              id="primaryDomain"
              name="primaryDomain"
              defaultValue={v["primaryDomain"]}
            />
          </FormField>
          <FormField
            label="Default locale"
            htmlFor="defaultLocale"
            error={state.fieldErrors["defaultLocale"]}
          >
            <Input
              id="defaultLocale"
              name="defaultLocale"
              defaultValue={v["defaultLocale"]}
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

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
