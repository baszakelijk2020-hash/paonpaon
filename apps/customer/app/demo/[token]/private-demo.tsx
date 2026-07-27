"use client";

import { RetailerTheme } from "@paon/ui/components/RetailerTheme";
import { useActionState, useState } from "react";

import { openPrivateDemo, type OpenDemoState } from "./actions";

const initialState: OpenDemoState = {};

export function PrivateDemo({ publicToken }: { publicToken: string }) {
  const action = openPrivateDemo.bind(null, publicToken);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [activeRole, setActiveRole] = useState("owner");
  const demo = state.demo;

  if (!demo) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#1a1a1a] px-5 py-16 text-white">
        <section className="w-full max-w-lg rounded-[1.25rem] border border-white/15 bg-white/5 p-7 backdrop-blur-xl sm:p-10">
          <p className="font-display text-2xl tracking-[0.24em]">PAON</p>
          <p className="mt-12 text-xs uppercase tracking-[0.2em] text-white/45">
            Private demonstration
          </p>
          <h1 className="font-display mt-4 text-5xl leading-none">
            Enter the room.
          </h1>
          <p className="mt-5 text-sm leading-6 text-white/55">
            This retailer-specific environment is private, synthetic and
            time-limited. Use the access code shared by PAON.
          </p>
          <form action={formAction} className="mt-8">
            <label className="text-xs text-white/55">
              Access code
              <input
                className="mt-2 min-h-12 w-full rounded-md border border-white/20 bg-white/10 px-4 text-white"
                name="accessCode"
                type="password"
                required
              />
            </label>
            {state.error ? (
              <p className="mt-3 text-sm text-[#f0a49d]" role="alert">
                {state.error}
              </p>
            ) : null}
            <button
              className="mt-6 min-h-12 w-full rounded-md bg-white px-5 text-sm text-black disabled:opacity-50"
              type="submit"
              disabled={pending}
            >
              {pending ? "Opening securely…" : "Open private demo"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  const persona =
    demo.syntheticData.personas.find((item) => item.key === activeRole) ??
    demo.syntheticData.personas[0];

  return (
    <RetailerTheme theme={demo.configuration.theme}>
      <div className="min-h-screen bg-[var(--retailer-surface)] text-[var(--retailer-ink)]">
        <header className="border-b border-black/10 px-5 py-4 sm:px-8">
          <div className="mx-auto flex max-w-[92rem] items-center justify-between">
            <div>
              <p className="text-xl font-[var(--font-retailer-display)]">
                {demo.companyName}
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] opacity-40">
                A private PAON demonstration
              </p>
            </div>
            <p className="text-xs opacity-45">
              Synthetic environment · expires{" "}
              {new Date(demo.expiresAt).toLocaleDateString()}
            </p>
          </div>
        </header>

        <main className="mx-auto max-w-[92rem] px-5 py-10 sm:px-8 sm:py-16">
          <section className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] opacity-45">
                Personalized product narrative
              </p>
              <h1 className="mt-4 text-5xl font-[var(--font-retailer-display)] leading-none sm:text-7xl">
                {demo.configuration.marketingHeadline}
              </h1>
            </div>
            <p className="max-w-2xl text-base leading-8 opacity-60">
              {demo.configuration.personalizedIntroduction}
            </p>
          </section>

          <section className="mt-14">
            <div className="flex gap-2 overflow-x-auto pb-3">
              {demo.syntheticData.personas.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveRole(item.key)}
                  className={`min-h-11 whitespace-nowrap rounded-[var(--retailer-radius)] px-4 text-xs ${
                    item.key === activeRole
                      ? "bg-[var(--retailer-accent)] text-white"
                      : "border border-black/15"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mt-4 overflow-hidden rounded-[var(--retailer-radius)] bg-[#1a1a1a] text-white shadow-[var(--shadow-elevated)]">
              <div className="grid lg:grid-cols-[15rem_1fr]">
                <aside className="hidden border-r border-white/10 p-6 lg:block">
                  <p className="tracking-[0.2em]">PAON</p>
                  <div className="mt-16 space-y-5 text-xs text-white/45">
                    <p className="text-white">Today</p>
                    <p>Relationships</p>
                    <p>Appointments</p>
                    <p>Garments</p>
                    <p>Conversations</p>
                  </div>
                </aside>
                <div className="p-6 sm:p-10">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">
                    What needs attention now
                  </p>
                  <h2 className="mt-5 max-w-4xl text-4xl font-[var(--font-retailer-display)] leading-none sm:text-6xl">
                    {persona?.attention}
                  </h2>
                  <button className="mt-8 min-h-11 rounded-[var(--retailer-radius)] bg-white px-5 text-sm text-black">
                    {persona?.primaryAction} →
                  </button>
                  <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {Object.entries(demo.syntheticData.metrics).map(
                      ([label, value]) => (
                        <div key={label} className="rounded-lg bg-white/10 p-4">
                          <p className="text-[10px] text-white/45">{label}</p>
                          <p className="mt-2 text-xl">{value}</p>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-16 grid gap-5 lg:grid-cols-3">
            <article className="rounded-[var(--retailer-radius)] border bg-white/55 p-6">
              <p className="text-xs uppercase tracking-[0.18em] opacity-45">
                Relationship book
              </p>
              {demo.syntheticData.customers.map((customer) => (
                <div
                  key={customer.name}
                  className="border-b py-4 last:border-0"
                >
                  <p className="text-xl font-[var(--font-retailer-display)]">
                    {customer.name}
                  </p>
                  <p className="mt-1 text-xs opacity-50">
                    {customer.nextMoment} · {customer.lifetimeValue}
                  </p>
                </div>
              ))}
            </article>
            <article className="rounded-[var(--retailer-radius)] border bg-white/55 p-6">
              <p className="text-xs uppercase tracking-[0.18em] opacity-45">
                Garments in motion
              </p>
              {demo.syntheticData.alterations.map((garment) => (
                <div
                  key={garment.garment}
                  className="border-b py-4 last:border-0"
                >
                  <p className="text-sm font-medium">{garment.garment}</p>
                  <div className="mt-2 h-1 rounded-full bg-black/10">
                    <div
                      className="h-full bg-[var(--retailer-accent)]"
                      style={{ width: `${garment.progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs opacity-50">
                    {garment.status} · {garment.due}
                  </p>
                </div>
              ))}
            </article>
            <article className="rounded-[var(--retailer-radius)] border bg-white/55 p-6">
              <p className="text-xs uppercase tracking-[0.18em] opacity-45">
                Today’s appointments
              </p>
              {demo.syntheticData.appointments.map((appointment) => (
                <div
                  key={`${appointment.time}-${appointment.customer}`}
                  className="grid grid-cols-[3.5rem_1fr] border-b py-4 last:border-0"
                >
                  <p className="text-sm">{appointment.time}</p>
                  <div>
                    <p className="text-sm font-medium">
                      {appointment.customer}
                    </p>
                    <p className="mt-1 text-xs opacity-50">
                      {appointment.purpose} · {appointment.status}
                    </p>
                  </div>
                </div>
              ))}
            </article>
          </section>
        </main>
      </div>
    </RetailerTheme>
  );
}
