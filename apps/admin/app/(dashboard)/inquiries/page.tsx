import { CommercialInquiryRepository } from "@paon/database";
import { buttonVariants } from "@paon/ui/components/Button";
import Link from "next/link";

import { InquiriesList } from "./inquiries-list";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function CommercialInquiriesPage() {
  const inquiries = await new CommercialInquiryRepository(
    await getSupabaseServerClient(),
  ).findAll();
  const fresh = inquiries.filter((inquiry) => inquiry.status === "new").length;

  return (
    <div className="space-y-10">
      <section className="rounded-[var(--radius-md)] bg-[var(--color-stone-900)] p-7 text-white sm:p-10">
        <p className="text-xs uppercase tracking-[0.2em] text-white/45">
          Marketing intake
        </p>
        <h1 className="font-display mt-5 text-5xl leading-none sm:text-7xl">
          Inquiries
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-white/55">
          Demo requests, consultations and paid-pilot interest from the public
          site. Triage status here; convert promising rows into Demo Studio
          prospects. Resend delivery remains blocked until keys are provisioned.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--radius-md)] border bg-white p-6">
          <p className="text-xs text-[var(--color-stone-500)]">Total</p>
          <p className="font-display mt-3 text-4xl">{inquiries.length}</p>
        </div>
        <div className="rounded-[var(--radius-md)] border bg-white p-6">
          <p className="text-xs text-[var(--color-stone-500)]">New</p>
          <p className="font-display mt-3 text-4xl">{fresh}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-[var(--radius-md)] border bg-white p-4 sm:p-6">
        {inquiries.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-sm text-[var(--color-stone-500)]">
              No inquiries yet. Forms on /demo-request, /consultation and /pilot
              land here.
            </p>
            <Link
              href="/prospects/new"
              className={buttonVariants({ className: "mt-6" })}
            >
              Create prospect manually
            </Link>
          </div>
        ) : (
          <InquiriesList
            inquiries={inquiries.map((inquiry) => ({
              id: inquiry.id,
              inquiryType: inquiry.inquiryType,
              companyName: inquiry.companyName,
              contactName: inquiry.contactName,
              email: inquiry.email,
              ...(inquiry.websiteUrl ? { websiteUrl: inquiry.websiteUrl } : {}),
              objective: inquiry.objective,
              ...(inquiry.requestedPlanKey
                ? { requestedPlanKey: inquiry.requestedPlanKey }
                : {}),
              status: inquiry.status,
              createdAt: inquiry.createdAt,
            }))}
          />
        )}
      </section>
    </div>
  );
}
