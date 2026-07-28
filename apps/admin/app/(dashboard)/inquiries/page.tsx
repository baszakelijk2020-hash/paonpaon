import { CommercialInquiryRepository } from "@paon/database";

import { getSupabaseServerClient } from "@/lib/supabase-server";

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

export default async function CommercialInquiriesPage() {
  const inquiries = await new CommercialInquiryRepository(
    await getSupabaseServerClient(),
  ).findAll();
  const fresh = inquiries.filter((inquiry) => inquiry.status === "new").length;

  return (
    <div className="space-y-10">
      <section className="rounded-[1.25rem] bg-stone-900 p-7 text-white sm:p-10">
        <p className="text-xs uppercase tracking-[0.2em] text-white/45">
          Marketing intake
        </p>
        <h1 className="font-display mt-5 text-5xl leading-none sm:text-7xl">
          Commercial inquiries
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-white/55">
          Demo requests, consultations and paid-pilot interest from the public
          site. Resend is not live yet — this list is the handoff until email
          delivery is provisioned.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[1.25rem] border bg-white p-6">
          <p className="text-xs text-stone-500">Total</p>
          <p className="font-display mt-3 text-4xl">{inquiries.length}</p>
        </div>
        <div className="rounded-[1.25rem] border bg-white p-6">
          <p className="text-xs text-stone-500">Unread / new</p>
          <p className="font-display mt-3 text-4xl">{fresh}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.25rem] border bg-white">
        {inquiries.length === 0 ? (
          <p className="p-8 text-sm text-stone-500">
            No inquiries yet. Forms on /demo-request, /consultation and /pilot
            land here.
          </p>
        ) : (
          <ul className="divide-y">
            {inquiries.map((inquiry) => (
              <li key={inquiry.id} className="p-6 sm:p-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
                      {TYPE_LABELS[inquiry.inquiryType]} ·{" "}
                      {STATUS_LABELS[inquiry.status]}
                    </p>
                    <h2 className="font-display mt-2 text-2xl">
                      {inquiry.companyName}
                    </h2>
                    <p className="mt-1 text-sm text-stone-600">
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
                  <time
                    className="shrink-0 text-xs text-stone-400"
                    dateTime={inquiry.createdAt}
                  >
                    {new Date(inquiry.createdAt).toLocaleString()}
                  </time>
                </div>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-700">
                  {inquiry.objective}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
