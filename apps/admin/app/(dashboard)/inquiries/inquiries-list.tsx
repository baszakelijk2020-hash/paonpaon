"use client";

import { SearchableCollection } from "@paon/ui/components/SearchableCollection";
import Link from "next/link";
import { useActionState } from "react";

import { updateInquiryStatus } from "./actions";

const TYPE_LABELS = {
  personalized_demo: "Personalized demo",
  consultation: "Consultation",
  paid_pilot: "Paid pilot",
} as const;

const STATUS_LABELS = {
  new: "New",
  reviewed: "Reviewed",
  converted: "Converted",
  closed: "Closed",
} as const;

export type InquiryRow = {
  id: string;
  inquiryType: keyof typeof TYPE_LABELS;
  companyName: string;
  contactName: string;
  email: string;
  websiteUrl?: string;
  objective: string;
  requestedPlanKey?: string;
  status: keyof typeof STATUS_LABELS;
  createdAt: string;
};

function InquiryStatusForm({ inquiry }: { inquiry: InquiryRow }) {
  const [state, action, pending] = useActionState(updateInquiryStatus, {});

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="inquiryId" value={inquiry.id} />
      <div className="flex flex-wrap gap-2">
        <select
          name="status"
          defaultValue={inquiry.status}
          disabled={pending}
          className="h-9 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-2 text-xs disabled:opacity-50"
          aria-label="Inquiry status"
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-[var(--radius-md)] bg-[var(--color-stone-900)] px-3 text-xs text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {state.formError ? (
        <p role="alert" className="text-xs text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="text-xs text-[var(--color-success-500)]">
          Status updated.
        </p>
      ) : null}
    </form>
  );
}

export function InquiriesList({ inquiries }: { inquiries: InquiryRow[] }) {
  return (
    <SearchableCollection
      items={inquiries}
      placeholder="Search company, contact or email…"
      label="Search inquiries"
      predicate={(inquiry, query) =>
        inquiry.companyName.toLowerCase().includes(query) ||
        inquiry.contactName.toLowerCase().includes(query) ||
        inquiry.email.toLowerCase().includes(query) ||
        inquiry.objective.toLowerCase().includes(query)
      }
      empty={
        <p className="p-8 text-sm text-[var(--color-stone-500)]">
          No inquiries match that search.
        </p>
      }
    >
      {(filtered) => (
        <ul className="divide-y">
          {filtered.map((inquiry) => (
            <li key={inquiry.id} className="p-6 sm:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-stone-500)]">
                    {TYPE_LABELS[inquiry.inquiryType]} ·{" "}
                    {STATUS_LABELS[inquiry.status]}
                  </p>
                  <h2 className="font-display mt-2 text-2xl">
                    {inquiry.companyName}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--color-stone-600)]">
                    {inquiry.contactName} ·{" "}
                    <a
                      className="underline underline-offset-2"
                      href={`mailto:${inquiry.email}`}
                    >
                      {inquiry.email}
                    </a>
                    {inquiry.websiteUrl ? (
                      <>
                        {" "}
                        ·{" "}
                        <a
                          className="underline underline-offset-2"
                          href={inquiry.websiteUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Website
                        </a>
                      </>
                    ) : null}
                    {inquiry.requestedPlanKey ? (
                      <> · Plan {inquiry.requestedPlanKey}</>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                  <time
                    className="text-xs text-[var(--color-stone-400)]"
                    dateTime={inquiry.createdAt}
                  >
                    {new Date(inquiry.createdAt).toLocaleString()}
                  </time>
                  <InquiryStatusForm inquiry={inquiry} />
                  {inquiry.status !== "converted" ? (
                    <Link
                      href={`/prospects/new?company=${encodeURIComponent(inquiry.companyName)}&email=${encodeURIComponent(inquiry.email)}&contact=${encodeURIComponent(inquiry.contactName)}`}
                      className="text-xs underline underline-offset-2"
                    >
                      Create prospect
                    </Link>
                  ) : null}
                </div>
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--color-stone-700)]">
                {inquiry.objective}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SearchableCollection>
  );
}
