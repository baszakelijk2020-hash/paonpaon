"use client";

import type { CustomerConsentRecord, CustomerPreferences } from "@paon/domain";
import { isConsentGranted } from "@paon/domain";
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

function consentGranted(
  records: readonly CustomerConsentRecord[],
  purpose: CustomerConsentRecord["purpose"],
): boolean {
  return isConsentGranted(
    records.find((record) => record.purpose === purpose) ?? null,
  );
}

export function PreferencesForm({
  retailerId,
  retailerName,
  preferences,
  consentRecords,
}: {
  retailerId: string;
  retailerName: string;
  preferences: CustomerPreferences | null;
  consentRecords: readonly CustomerConsentRecord[];
}) {
  const personalizationOptIn = consentGranted(
    consentRecords,
    "personalization",
  );
  const marketingOptIn =
    consentGranted(consentRecords, "marketing") ||
    (preferences?.marketingOptIn ?? false);
  const locationOptIn = consentGranted(consentRecords, "location");

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
      marketingOptIn: marketingOptIn ? "on" : "",
      personalizationOptIn: personalizationOptIn ? "on" : "",
      locationOptIn: locationOptIn ? "on" : "",
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
    <Card className="flex flex-col gap-4">
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

        <fieldset className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-4">
          <legend className="px-1 text-sm font-medium text-[var(--color-stone-900)]">
            Intelligence and privacy
          </legend>
          <p className="text-sm text-[var(--color-stone-500)]">
            Personalization, marketing, and location are separate choices.
            Turning off personalization stops new browsing signals and begins
            the documented retention period for existing interaction evidence.
          </p>
          <label className="flex items-start gap-2 text-sm text-[var(--color-stone-700)]">
            <input
              type="checkbox"
              name="personalizationOptIn"
              defaultChecked={v["personalizationOptIn"] === "on"}
              className="mt-0.5"
            />
            <span>
              Personalize my experience using views, searches, favourites, and
              similar interaction signals with this house.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-[var(--color-stone-700)]">
            <input
              type="checkbox"
              name="marketingOptIn"
              defaultChecked={v["marketingOptIn"] === "on"}
              className="mt-0.5"
            />
            <span>Send me marketing updates and offers from this house.</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-[var(--color-stone-700)]">
            <input
              type="checkbox"
              name="locationOptIn"
              defaultChecked={v["locationOptIn"] === "on"}
              className="mt-0.5"
            />
            <span>
              Use my location for weather-aware recommendations when available.
              Location is optional and never required for service.
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
