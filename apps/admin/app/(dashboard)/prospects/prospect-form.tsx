"use client";

import type { SubscriptionPlan } from "@paon/domain";
import { useActionState } from "react";

import { createProspect, type ProspectActionState } from "./actions";

const initialState: ProspectActionState = {};

export function ProspectForm({ plans }: { plans: SubscriptionPlan[] }) {
  const [state, action, pending] = useActionState(createProspect, initialState);
  const input =
    "mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm";
  return (
    <form action={action} className="space-y-8">
      {state.error ? (
        <p
          className="rounded-md bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      <section className="rounded-[1.25rem] border bg-white p-6 sm:p-8">
        <h2 className="font-display text-2xl">Retail house</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="text-sm">
            Company name
            <input className={input} name="companyName" required />
          </label>
          <label className="text-sm">
            Website
            <input
              className={input}
              name="websiteUrl"
              type="url"
              placeholder="https://"
            />
          </label>
          <label className="text-sm">
            Primary contact
            <input className={input} name="primaryContactName" required />
          </label>
          <label className="text-sm">
            Contact email
            <input
              className={input}
              name="primaryContactEmail"
              type="email"
              required
            />
          </label>
          <label className="text-sm">
            Contact phone
            <input className={input} name="primaryContactPhone" type="tel" />
          </label>
          <label className="text-sm">
            Source
            <select
              className={input}
              name="source"
              defaultValue="founder_outreach"
            >
              <option value="founder_outreach">Founder outreach</option>
              <option value="inbound_demo">Inbound demo request</option>
              <option value="referral">Referral</option>
              <option value="event">Industry event</option>
            </select>
          </label>
        </div>
      </section>
      <section className="rounded-[1.25rem] border bg-white p-6 sm:p-8">
        <h2 className="font-display text-2xl">Commercial hypothesis</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="text-sm">
            Recommended package
            <select className={input} name="recommendedPlanId" required>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Next revenue action
            <input
              className={input}
              name="nextAction"
              placeholder="Prepare personalized demonstration"
            />
          </label>
          <label className="text-sm">
            Due date
            <input className={input} name="nextActionDueDate" type="date" />
          </label>
          <label className="text-sm sm:col-span-2">
            Observed opportunities
            <textarea
              className={`${input} min-h-28 py-3`}
              name="observedOpportunities"
              placeholder={"One evidence-based opportunity per line"}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Sales notes
            <textarea
              className={`${input} min-h-28 py-3`}
              name="salesNotes"
              placeholder="Research context, constraints and relationship notes"
            />
          </label>
        </div>
      </section>
      <button
        className="min-h-11 rounded-md bg-stone-900 px-6 text-sm text-white disabled:opacity-50"
        type="submit"
        disabled={pending}
      >
        {pending ? "Creating studio…" : "Create prospect and open Demo Studio"}
      </button>
    </form>
  );
}
