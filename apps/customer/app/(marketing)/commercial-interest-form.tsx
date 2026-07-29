"use client";

import type { CommercialInquiryType } from "@paon/domain";
import { useActionState } from "react";

import {
  submitCommercialInquiry,
  type CommercialInquiryActionState,
} from "./commercial-actions";

const initialState: CommercialInquiryActionState = {};

function FieldError({
  errors,
  name,
}: {
  errors?: Record<string, string[]> | undefined;
  name: string;
}) {
  const message = errors?.[name]?.[0];
  return message ? (
    <p className="mt-2 text-xs text-[#9b352c]">{message}</p>
  ) : null;
}

export function CommercialInterestForm({
  inquiryType,
  requestedPlanKey,
}: {
  inquiryType: CommercialInquiryType;
  requestedPlanKey?: string | undefined;
}) {
  const action = submitCommercialInquiry.bind(null, inquiryType);
  const [state, formAction, pending] = useActionState(action, initialState);

  if (state.inquiryId) {
    return (
      <div
        className="rounded-[var(--radius-xl)] border border-[#547052]/25 bg-[#edf1e9] p-8 sm:p-10"
        role="status"
      >
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#547052]">
          Request received
        </p>
        <h2 className="font-display mt-4 text-4xl leading-none">
          A considered conversation starts here.
        </h2>
        <p className="mt-5 max-w-xl text-sm leading-7 text-black/60">
          Your request is safely in the PAON commercial studio. We’ll review
          your objective and respond with the most useful next step—not a
          generic sales sequence.
        </p>
        <p className="mt-6 text-xs text-black/35">
          Reference {state.inquiryId.slice(0, 8).toUpperCase()}
        </p>
      </div>
    );
  }

  const inputClass =
    "mt-2 min-h-12 w-full rounded-[0.7rem] border border-black/15 bg-white/75 px-4 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10";

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {requestedPlanKey ? (
        <input type="hidden" name="requestedPlanKey" value={requestedPlanKey} />
      ) : null}
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="text-xs text-black/60">
          Retail house
          <input
            className={inputClass}
            name="companyName"
            autoComplete="organization"
            required
          />
          <FieldError errors={state.fieldErrors} name="companyName" />
        </label>
        <label className="text-xs text-black/60">
          Your name
          <input
            className={inputClass}
            name="contactName"
            autoComplete="name"
            required
          />
          <FieldError errors={state.fieldErrors} name="contactName" />
        </label>
        <label className="text-xs text-black/60">
          Work email
          <input
            className={inputClass}
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <FieldError errors={state.fieldErrors} name="email" />
        </label>
        <label className="text-xs text-black/60">
          Website <span className="text-black/35">(optional)</span>
          <input
            className={inputClass}
            name="websiteUrl"
            type="url"
            inputMode="url"
            placeholder="https://"
          />
          <FieldError errors={state.fieldErrors} name="websiteUrl" />
        </label>
      </div>
      <label className="block text-xs text-black/60">
        What would make this valuable?
        <textarea
          className={`${inputClass} min-h-36 py-4 leading-6`}
          name="objective"
          placeholder="Tell us about the customer or operational outcome you want to improve."
          required
        />
        <FieldError errors={state.fieldErrors} name="objective" />
      </label>
      {state.error ? (
        <p
          className="rounded-[0.7rem] bg-[#f4e5df] px-4 py-3 text-sm text-[#8d3028]"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-[0.7rem] bg-[#1a1a1a] px-6 text-sm font-medium text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-55 sm:w-auto"
      >
        {pending ? "Sending securely…" : "Send request"}
      </button>
      <p className="text-xs leading-5 text-black/35">
        Your details are used only to respond to this request. No tenant or
        customer data is created automatically.
      </p>
    </form>
  );
}
