"use client";

import type { ConversationIntent } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { useActionState, useState } from "react";

import {
  submitTableServiceInquiry,
  type TableServiceFormState,
} from "./table-service-actions";

const INTENT_OPTIONS: { value: ConversationIntent; label: string }[] = [
  { value: "wedding", label: "I'm getting married" },
  { value: "shirts", label: "I need new shirts" },
  { value: "style_help", label: "Help me find my style" },
  { value: "freeform", label: "Something else" },
];

const initial: TableServiceFormState = { values: {}, fieldErrors: {} };

export function TableServiceWidget({
  retailerId,
  retailerName,
}: {
  retailerId: string;
  retailerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<ConversationIntent | null>(null);
  const boundAction = submitTableServiceInquiry.bind(null, retailerId);
  const [state, formAction, isPending] = useActionState(boundAction, initial);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open ? (
        <div
          role="dialog"
          aria-label="Contact the retailer"
          className="glass-panel w-[min(22rem,calc(100vw-2.5rem))] rounded-[var(--radius-lg)] border border-[var(--color-stone-200)] p-5 shadow-[var(--shadow-elevated)]"
        >
          {state.submitted ? (
            <div role="status" aria-live="polite" className="py-4 text-center">
              <p className="text-sm font-medium text-[var(--color-stone-900)]">
                Thank you — {retailerName} will be in touch shortly.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
            </div>
          ) : (
            <form action={formAction} className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--color-stone-900)]">
                  How can we help?
                </p>
                <p className="text-xs text-[var(--color-stone-500)]">
                  No appointment needed — tell us what you&rsquo;re after.
                </p>
              </div>

              <input type="hidden" name="intent" value={intent ?? "freeform"} />
              <div className="flex flex-wrap gap-2">
                {INTENT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={intent === option.value}
                    onClick={() => setIntent(option.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)] active:scale-95 ${
                      intent === option.value
                        ? "border-[var(--color-stone-900)] bg-[var(--color-stone-900)] text-[var(--color-stone-0,#fff)]"
                        : "border-[var(--color-stone-200)] text-[var(--color-stone-700)]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <FormField
                label="Name"
                htmlFor="ts-name"
                error={state.fieldErrors["name"]}
              >
                <Input
                  id="ts-name"
                  name="name"
                  required
                  defaultValue={state.values["name"]}
                />
              </FormField>
              <FormField
                label="Email"
                htmlFor="ts-email"
                error={state.fieldErrors["email"]}
              >
                <Input
                  id="ts-email"
                  name="email"
                  type="email"
                  required
                  defaultValue={state.values["email"]}
                />
              </FormField>
              <FormField
                label="Message"
                htmlFor="ts-message"
                error={state.fieldErrors["message"]}
              >
                <textarea
                  id="ts-message"
                  name="message"
                  required
                  maxLength={2000}
                  defaultValue={state.values["message"]}
                  className="min-h-20 rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] p-2.5 text-sm"
                  placeholder="Five shirts, white, all a little different…"
                />
              </FormField>

              {state.formError ? (
                <p
                  role="alert"
                  className="text-sm text-[var(--color-danger-500)]"
                >
                  {state.formError}
                </p>
              ) : null}

              <div className="mt-1 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? "Sending…" : "Send"}
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : null}

      <Button
        onClick={() => setOpen((value) => !value)}
        className="shadow-lg"
        aria-expanded={open}
        aria-label="Contact us"
      >
        {open ? "Close" : "Ask us anything"}
      </Button>
    </div>
  );
}
