"use client";

import { Button } from "@paon/ui/components/Button";
import { Input } from "@paon/ui/components/Input";
import { useActionState } from "react";

import {
  subscribeToNewsletter,
  type NewsletterState,
} from "./newsletter-actions";

const initial: NewsletterState = {};

export function NewsletterSignup({ retailerId }: { retailerId: string }) {
  const boundAction = subscribeToNewsletter.bind(null, retailerId);
  const [state, formAction, isPending] = useActionState(boundAction, initial);

  if (state.subscribed) {
    return (
      <p className="text-sm text-[var(--color-stone-700)]">
        You&rsquo;re subscribed — look out for our next issue.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
      <Input
        name="email"
        type="email"
        placeholder="Your email"
        required
        className="sm:max-w-xs"
      />
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Subscribing…" : "Subscribe"}
      </Button>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
    </form>
  );
}
