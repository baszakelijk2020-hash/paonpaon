"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import {
  saveMorningRoutineSubscription,
  type DeliverySubscriptionState,
} from "./delivery-actions";

const initial: DeliverySubscriptionState = { fieldErrors: {} };

export function MorningRoutineDeliveryPanel({
  retailerId,
  customerId,
  subscription,
}: {
  retailerId: string;
  customerId: string;
  subscription: {
    optedIn: boolean;
    frequency: string;
    timezone: string;
    preferredLocalHour: number;
    channels: readonly string[];
    quietStartMinute?: number;
    quietEndMinute?: number;
  } | null;
}) {
  const [state, action, pending] = useActionState(
    saveMorningRoutineSubscription,
    initial,
  );
  const channels = new Set(subscription?.channels ?? ["in_app"]);

  return (
    <section
      className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-5 py-4"
      aria-labelledby={`morning-delivery-${retailerId}`}
    >
      <h3
        id={`morning-delivery-${retailerId}`}
        className="font-display text-lg text-[var(--color-stone-900)]"
      >
        Daily delivery
      </h3>
      <p className="mt-1 text-sm text-[var(--color-stone-500)]">
        Explicit opt-in only — separate from marketing consent. Unsubscribe
        anytime. Delivery uses your exact MorningRoutine selection.
      </p>

      <form action={action} className="mt-4 flex flex-col gap-3">
        <input type="hidden" name="retailerId" value={retailerId} />
        <input type="hidden" name="customerId" value={customerId} />

        <label className="flex items-center gap-2 text-sm text-[var(--color-stone-700)]">
          <input
            type="checkbox"
            name="optedIn"
            value="true"
            defaultChecked={subscription?.optedIn ?? false}
          />
          Send my MorningRoutine when it is ready
        </label>

        <label className="text-sm text-[var(--color-stone-700)]">
          Frequency
          <select
            name="frequency"
            defaultValue={subscription?.frequency ?? "daily"}
            className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 py-2"
          >
            <option value="daily">Daily</option>
            <option value="weekdays">Weekdays</option>
            <option value="weekly">Weekly (Mondays)</option>
          </select>
        </label>

        <label className="text-sm text-[var(--color-stone-700)]">
          Time zone
          <input
            name="timezone"
            defaultValue={subscription?.timezone ?? "Europe/Amsterdam"}
            className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 py-2"
          />
        </label>

        <label className="text-sm text-[var(--color-stone-700)]">
          Preferred local hour (0–23)
          <input
            type="number"
            name="preferredLocalHour"
            min={0}
            max={23}
            defaultValue={subscription?.preferredLocalHour ?? 7}
            className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 py-2"
          />
        </label>

        <fieldset className="text-sm text-[var(--color-stone-700)]">
          <legend className="mb-1">Channels</legend>
          <label className="mr-4 inline-flex items-center gap-2">
            <input
              type="checkbox"
              name="channels"
              value="in_app"
              defaultChecked={channels.has("in_app")}
            />
            In-app
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              name="channels"
              value="email"
              defaultChecked={channels.has("email")}
            />
            Email
          </label>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-[var(--color-stone-700)]">
            Quiet start (minute of day)
            <input
              type="number"
              name="quietStartMinute"
              min={0}
              max={1439}
              defaultValue={subscription?.quietStartMinute ?? ""}
              className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 py-2"
            />
          </label>
          <label className="text-sm text-[var(--color-stone-700)]">
            Quiet end (minute of day)
            <input
              type="number"
              name="quietEndMinute"
              min={0}
              max={1439}
              defaultValue={subscription?.quietEndMinute ?? ""}
              className="mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 py-2"
            />
          </label>
        </div>

        {state.formError ? (
          <p role="alert" className="text-sm text-[var(--color-danger-500)]">
            {state.formError}
          </p>
        ) : null}
        {state.success ? (
          <p role="status" className="text-sm text-[var(--color-stone-600)]">
            Delivery preferences saved.
          </p>
        ) : null}

        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save delivery preferences"}
        </Button>
      </form>
    </section>
  );
}
