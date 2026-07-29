"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import {
  saveMorningRoutineDeliverySettings,
  type MorningRoutineDeliveryFormState,
} from "./delivery-actions";

const initial: MorningRoutineDeliveryFormState = { fieldErrors: {} };

export interface MorningRoutineDeliverySettingsPanelProps {
  retailerId: string;
  customerId: string;
  subscription: {
    deliveryOptIn: boolean;
    frequency: string;
    channels: readonly string[];
    timezone: string;
    deliveryHourLocal: number;
    quietStartHour: number | null;
    quietEndHour: number | null;
    weeklyAnchorDow: number;
    unsubscribedAt?: string;
  } | null;
}

export function MorningRoutineDeliverySettingsPanel({
  retailerId,
  customerId,
  subscription,
}: MorningRoutineDeliverySettingsPanelProps) {
  const [state, formAction, pending] = useActionState(
    saveMorningRoutineDeliverySettings,
    initial,
  );
  const selectedChannels = new Set(subscription?.channels ?? ["in_app"]);

  return (
    <section
      className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-[var(--color-stone-50)] px-5 py-4"
      aria-labelledby={`morning-routine-delivery-${retailerId}`}
    >
      <h3
        id={`morning-routine-delivery-${retailerId}`}
        className="font-display text-lg text-[var(--color-stone-900)]"
      >
        Daily delivery
      </h3>
      <p className="mt-1 text-sm text-[var(--color-stone-500)]">
        Separate opt-in from marketing mail. Delivery uses your saved routine
        and respects personalization consent, quiet hours, and unsubscribe.
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="retailerId" value={retailerId} />
        <input type="hidden" name="customerId" value={customerId} />

        {state.formError ? (
          <p role="alert" className="text-sm text-[var(--color-danger-500)]">
            {state.formError}
          </p>
        ) : null}
        {state.success ? (
          <p role="status" className="text-sm text-[var(--color-success-500)]">
            Delivery settings saved.
          </p>
        ) : null}

        <label className="flex items-start gap-2 text-sm text-[var(--color-stone-700)]">
          <input
            type="checkbox"
            name="deliveryOptIn"
            className="mt-1"
            defaultChecked={subscription?.deliveryOptIn ?? false}
          />
          <span>
            Send my MorningRoutine each day when due — in-app and/or email. This
            is not marketing consent.
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Frequency" htmlFor={`frequency-${retailerId}`}>
            <Select
              id={`frequency-${retailerId}`}
              name="frequency"
              defaultValue={subscription?.frequency ?? "daily"}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </Select>
          </FormField>
          <FormField
            label="Delivery hour (local)"
            htmlFor={`deliveryHour-${retailerId}`}
          >
            <Select
              id={`deliveryHour-${retailerId}`}
              name="deliveryHourLocal"
              defaultValue={String(subscription?.deliveryHourLocal ?? 7)}
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, "0")}:00
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField label="Timezone" htmlFor={`timezone-${retailerId}`}>
          <Select
            id={`timezone-${retailerId}`}
            name="timezone"
            defaultValue={subscription?.timezone ?? "UTC"}
          >
            <option value="UTC">UTC</option>
            <option value="Europe/London">Europe/London</option>
            <option value="Europe/Paris">Europe/Paris</option>
            <option value="America/New_York">America/New_York</option>
          </Select>
        </FormField>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-[var(--color-stone-700)]">
            Channels
          </legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="channels"
              value="in_app"
              defaultChecked={selectedChannels.has("in_app")}
            />
            In-app notification
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="channels"
              value="email"
              defaultChecked={selectedChannels.has("email")}
            />
            Email (uses your account email)
          </label>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Quiet start hour (optional)"
            htmlFor={`quietStart-${retailerId}`}
          >
            <Select
              id={`quietStart-${retailerId}`}
              name="quietStartHour"
              defaultValue={
                subscription?.quietStartHour != null
                  ? String(subscription.quietStartHour)
                  : ""
              }
            >
              <option value="">None</option>
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, "0")}:00
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Quiet end hour (optional)"
            htmlFor={`quietEnd-${retailerId}`}
          >
            <Select
              id={`quietEnd-${retailerId}`}
              name="quietEndHour"
              defaultValue={
                subscription?.quietEndHour != null
                  ? String(subscription.quietEndHour)
                  : ""
              }
            >
              <option value="">None</option>
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, "0")}:00
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <input
          type="hidden"
          name="weeklyAnchorDow"
          value={String(subscription?.weeklyAnchorDow ?? 1)}
        />

        {subscription?.unsubscribedAt ? (
          <p className="text-xs text-[var(--color-stone-500)]">
            Previously unsubscribed at {subscription.unsubscribedAt}. Re-enable
            delivery above to opt back in.
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save delivery settings"}
          </Button>
        </div>
      </form>
    </section>
  );
}
