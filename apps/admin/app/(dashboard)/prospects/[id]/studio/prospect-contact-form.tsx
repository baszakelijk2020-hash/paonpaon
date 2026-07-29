"use client";

import { useActionState } from "react";

import {
  updateProspectContact,
  type ProspectContactActionState,
} from "../../actions";

const initial: ProspectContactActionState = {};

export function ProspectContactForm({
  prospectId,
  companyName,
  websiteUrl,
  primaryContactName,
  primaryContactEmail,
  primaryContactPhone,
  nextAction,
}: {
  prospectId: string;
  companyName: string;
  websiteUrl?: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone?: string;
  nextAction?: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateProspectContact,
    initial,
  );

  return (
    <form
      action={formAction}
      className="mt-6 grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white p-4 sm:grid-cols-2"
    >
      <input type="hidden" name="prospectId" value={prospectId} />
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-stone-500)] sm:col-span-2">
        Contact & next action
      </p>
      <label className="text-sm">
        Company
        <input
          name="companyName"
          required
          defaultValue={companyName}
          className="mt-1 h-10 w-full rounded-[var(--radius-md)] border px-3 text-sm"
        />
      </label>
      <label className="text-sm">
        Website
        <input
          name="websiteUrl"
          type="url"
          defaultValue={websiteUrl ?? ""}
          className="mt-1 h-10 w-full rounded-[var(--radius-md)] border px-3 text-sm"
        />
      </label>
      <label className="text-sm">
        Contact name
        <input
          name="primaryContactName"
          required
          defaultValue={primaryContactName}
          className="mt-1 h-10 w-full rounded-[var(--radius-md)] border px-3 text-sm"
        />
      </label>
      <label className="text-sm">
        Contact email
        <input
          name="primaryContactEmail"
          type="email"
          required
          defaultValue={primaryContactEmail}
          className="mt-1 h-10 w-full rounded-[var(--radius-md)] border px-3 text-sm"
        />
      </label>
      <label className="text-sm">
        Phone
        <input
          name="primaryContactPhone"
          defaultValue={primaryContactPhone ?? ""}
          className="mt-1 h-10 w-full rounded-[var(--radius-md)] border px-3 text-sm"
        />
      </label>
      <label className="text-sm">
        Next action
        <input
          name="nextAction"
          defaultValue={nextAction ?? ""}
          className="mt-1 h-10 w-full rounded-[var(--radius-md)] border px-3 text-sm"
        />
      </label>
      {state.error ? (
        <p
          className="text-sm text-[var(--color-danger-500)] sm:col-span-2"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p
          className="text-sm text-[var(--color-stone-600)] sm:col-span-2"
          role="status"
        >
          Contact saved.
        </p>
      ) : null}
      <div className="flex justify-end sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-[var(--radius-md)] bg-[var(--color-stone-900)] px-4 text-sm text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save contact"}
        </button>
      </div>
    </form>
  );
}
