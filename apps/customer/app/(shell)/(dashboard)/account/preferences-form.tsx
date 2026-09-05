"use client";

import type { CustomerPreferences } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import { savePreferences, type PreferencesFormState } from "./actions";

const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CHF",
  "JPY",
  "AED",
  "HKD",
  "SGD",
] as const;

const CHANNELS = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "push", label: "Push" },
  { value: "in_app", label: "In-app" },
] as const;

export function PreferencesForm({
  retailerId,
  retailerName,
  preferences,
}: {
  retailerId: string;
  retailerName: string;
  preferences: CustomerPreferences | null;
}) {
  const initialState: PreferencesFormState = {
    fieldErrors: {},
    values: {
      retailerId,
      preferredLocale: preferences?.preferredLocale ?? "en-US",
      preferredCurrency: preferences?.preferredCurrency ?? "USD",
      communicationChannels: preferences
        ? [...preferences.communicationChannels]
        : ["email"],
      styleNotes: preferences?.styleNotes ?? "",
      marketingOptIn: preferences?.marketingOptIn ? "on" : "",
      personalizationOptIn: preferences?.personalizationOptIn ? "on" : "",
      locationOptIn: preferences?.locationOptIn ? "on" : "",
    },
  };
  const [state, formAction, isPending] = useActionState(
    savePreferences,
    initialState,
  );
  const v = state.values;
  const selectedChannels = new Set(
    Array.isArray(v["communicationChannels"]) ? v["communicationChannels"] : [],
  );

  return (
    <Card className="flex flex-col gap-4 border-[var(--customer-border)] bg-gradient-to-br from-[var(--customer-paper)] to-[#e4e1d3] shadow-sm">
      <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
        {retailerName}
      </h2>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="retailerId" value={retailerId} />
        {state.formError ? (
          <p role="alert" className="text-sm text-[var(--color-danger-500)]">
            {state.formError}
          </p>
        ) : null}
        {state.success ? (
          <p role="status" className="text-sm text-[var(--color-success-500)]">
            Preferences saved.
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Preferred language"
            htmlFor={`preferredLocale-${retailerId}`}
            error={state.fieldErrors["preferredLocale"]}
          >
            <Input
              id={`preferredLocale-${retailerId}`}
              name="preferredLocale"
              defaultValue={v["preferredLocale"] as string}
              required
            />
          </FormField>
          <FormField
            label="Preferred currency"
            htmlFor={`preferredCurrency-${retailerId}`}
            error={state.fieldErrors["preferredCurrency"]}
          >
            <Select
              id={`preferredCurrency-${retailerId}`}
              name="preferredCurrency"
              defaultValue={v["preferredCurrency"] as string}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-[var(--color-stone-700)]">
            Contact me by
          </legend>
          <div className="flex flex-wrap gap-4">
            {CHANNELS.map((channel) => (
              <label
                key={channel.value}
                className="flex items-center gap-2 text-sm text-[var(--color-stone-700)]"
              >
                <input
                  type="checkbox"
                  name="communicationChannels"
                  value={channel.value}
                  defaultChecked={selectedChannels.has(channel.value)}
                />
                {channel.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-[var(--color-stone-700)]">
            Privacy and personalisation
          </legend>
          <label className="flex items-start gap-2 text-sm text-[var(--color-stone-700)]">
            <input
              type="checkbox"
              name="personalizationOptIn"
              className="mt-1"
              defaultChecked={v["personalizationOptIn"] === "on"}
            />
            <span>
              Allow personalised recommendations and advisor preparation from my
              browsing and saved items with this retailer. Turning this off
              stops new use and removes personalisation signals.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-[var(--color-stone-700)]">
            <input
              type="checkbox"
              name="marketingOptIn"
              className="mt-1"
              defaultChecked={v["marketingOptIn"] === "on"}
            />
            <span>Send me marketing updates and offers</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-[var(--color-stone-700)]">
            <input
              type="checkbox"
              name="locationOptIn"
              className="mt-1"
              defaultChecked={v["locationOptIn"] === "on"}
            />
            <span>
              Allow optional location for weather-aware routines later. Not
              required for personalisation.
            </span>
          </label>
        </fieldset>

        <FormField
          label="Style notes"
          htmlFor={`styleNotes-${retailerId}`}
          hint="Optional — sizes, fabrics, colors you love or avoid"
          error={state.fieldErrors["styleNotes"]}
        >
          <textarea
            id={`styleNotes-${retailerId}`}
            name="styleNotes"
            defaultValue={v["styleNotes"] as string}
            rows={3}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-3 py-2 text-sm text-[var(--color-stone-900)] transition-colors duration-150 ease-[var(--ease-out-quiet)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-stone-900)] focus-visible:ring-offset-2"
          />
        </FormField>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save preferences"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
