import type { CommercialInquiryType } from "@paon/domain";

import { CommercialInterestForm } from "./commercial-interest-form";

const pageCopy = {
  personalized_demo: {
    eyebrow: "Personalized product narrative",
    title: "See PAON through the character of your own retail house.",
    body: "We prepare a focused environment around your brand, role mix and most important customer journey. The conversation shows how the system behaves—not a theatre of disconnected screens.",
    detail:
      "A guided view of the relevant product areas, package fit and a practical route to a paid pilot.",
  },
  consultation: {
    eyebrow: "Retailer consultation",
    title: "Start with the commercial or operating question that matters.",
    body: "Bring a growth ambition, customer-experience challenge or operational constraint. We’ll map it to the clearest PAON package and distinguish software, implementation and optional managed support.",
    detail:
      "A candid working session with a documented recommendation and no hidden scope.",
  },
  paid_pilot: {
    eyebrow: "Paid pilot",
    title: "Prove one valuable outcome in the reality of your business.",
    body: "A pilot is deliberately bounded: one outcome, named participants, acceptance criteria and a clear decision at the end. It is not a vague free trial or an automatic production rollout.",
    detail:
      "Pilot scope, implementation work and recurring software are quoted separately.",
  },
} satisfies Record<
  CommercialInquiryType,
  { eyebrow: string; title: string; body: string; detail: string }
>;

export function CommercialPage({
  inquiryType,
  requestedPlanKey,
}: {
  inquiryType: CommercialInquiryType;
  requestedPlanKey?: string | undefined;
}) {
  const copy = pageCopy[inquiryType];
  return (
    <main className="px-5 pb-24 pt-32 sm:px-8 sm:pt-40">
      <section className="mx-auto grid max-w-[92rem] gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <p className="text-[10px] uppercase tracking-[0.22em] text-black/45">
            {copy.eyebrow}
          </p>
          <h1 className="font-display mt-5 max-w-3xl text-5xl leading-[0.94] sm:text-7xl">
            {copy.title}
          </h1>
          <p className="mt-7 max-w-xl text-base leading-8 text-black/55">
            {copy.body}
          </p>
          <div className="mt-10 border-l border-black/25 pl-5">
            <p className="text-sm leading-6 text-black/60">{copy.detail}</p>
          </div>
        </div>
        <div className="rounded-[var(--radius-xl)] border border-black/10 bg-white/55 p-6 shadow-[var(--shadow-subtle)] sm:p-10">
          <p className="font-display mb-8 text-3xl">Tell us where to focus.</p>
          <CommercialInterestForm
            inquiryType={inquiryType}
            requestedPlanKey={requestedPlanKey}
          />
        </div>
      </section>
    </main>
  );
}
