"use client";

import { Button, buttonVariants } from "@paon/ui/components/Button";
import Image from "next/image";
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
          <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
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
        <div className="overflow-hidden rounded-[var(--radius-md)] bg-[#f4f1ec]">
          {state.result.weather ? (
            <div className="flex items-center justify-between bg-[#1a1a1a] px-4 py-2 text-white">
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/70">
                {state.result.weather.city}
              </p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/70">
                {state.result.weather.temperatureCelsius}°C ·{" "}
                {state.result.weather.description}
              </p>
            </div>
          ) : null}
          <div className="p-4">
            <p className="text-sm leading-6 text-[var(--color-stone-700)]">
              Hi {customerName},{" "}
              {state.result.weather
                ? `with ${state.result.weather.temperatureCelsius}°C today calls for something special. `
                : ""}
              {state.result.rationale}
            </p>
            {state.result.productImageUrl ? (
              <div className="relative mt-3 aspect-[4/5] w-full overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-stone-100)]">
                <Image
                  src={state.result.productImageUrl}
                  alt={state.result.productName}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
            ) : null}
            <p className="font-display mt-3 text-lg text-[var(--color-stone-900)]">
              {state.result.productName}
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
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                  })}
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
        </div>
      ) : null}
    </div>
  );
}
