"use client";

import { Button, buttonVariants } from "@paon/ui/components/Button";
import Link from "next/link";
import { useActionState } from "react";

import { generateTodaysPick, type TodaysPickState } from "./actions";

import { startConversation } from "@/app/(dashboard)/messages/actions";

const initial: TodaysPickState = {};

export function TodaysPick({
  slug,
  retailerId,
  customerId,
  retailerName,
  customerName,
}: {
  slug: string;
  retailerId: string;
  customerId: string;
  retailerName: string;
  customerName: string;
}) {
  const boundAction = generateTodaysPick.bind(
    null,
    retailerId,
    customerId,
    retailerName,
    customerName,
  );
  const [state, action, pending] = useActionState(boundAction, initial);

  return (
    <div className="border-t border-[var(--color-stone-100)] px-6 py-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-[var(--font-accent)] font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
            Today&rsquo;s pick
          </p>
          <p className="text-sm text-[var(--color-stone-500)]">
            One piece from {retailerName}, chosen for you.
          </p>
        </div>
        {!state.result ? (
          <form action={action}>
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={pending}
            >
              {pending ? "Thinking…" : "Show me"}
            </Button>
          </form>
        ) : null}
      </div>

      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}

      {state.result ? (
        <div className="rounded-[var(--radius-md)] bg-[var(--color-stone-50)] p-4">
          {state.result.weather ? (
            <p className="mb-2 text-xs text-[var(--color-stone-500)]">
              {state.result.weather.temperatureCelsius}°C and{" "}
              {state.result.weather.description} in {state.result.weather.city}{" "}
              today
            </p>
          ) : null}
          <p className="text-lg font-[var(--font-display)] text-[var(--color-stone-900)]">
            {state.result.productName}
          </p>
          <p className="mt-1 text-sm text-[var(--color-stone-700)]">
            {state.result.rationale}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/r/${slug}/products/${state.result.productSlug}`}
              className={buttonVariants({ size: "sm" })}
            >
              View it
            </Link>
            <form action={startConversation}>
              <input type="hidden" name="retailerId" value={retailerId} />
              <input
                type="hidden"
                name="body"
                value={`I'd like to know more about ${state.result.productName}.`}
              />
              <button
                type="submit"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Ask your Style Advisor
              </button>
            </form>
            <Link
              href={`/r/${slug}/appointments`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Book a fitting
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
