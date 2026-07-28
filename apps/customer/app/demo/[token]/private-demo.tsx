"use client";

import { RetailerTheme } from "@paon/ui/components/RetailerTheme";
import Link from "next/link";
import { useActionState } from "react";

import { openPrivateDemo, type OpenDemoState } from "./actions";

const initialState: OpenDemoState = {};

export function PrivateDemo({
  publicToken,
  retailerAppUrl,
}: {
  publicToken: string;
  retailerAppUrl?: string | undefined;
}) {
  const action = openPrivateDemo.bind(null, publicToken);
  const [state, formAction, pending] = useActionState(action, initialState);
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
            This retailer-specific environment is private and time-limited. Use
            the access code shared by PAON to open their live storefront.
          </p>
          <form action={formAction} className="mt-8">
            <label className="text-xs text-white/55">
              Access code
              <input
                className="mt-2 min-h-12 w-full rounded-md border border-white/20 bg-white/10 px-4 text-white"
                name="accessCode"
                type="password"
                required
                minLength={6}
                maxLength={80}
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

  const storefrontHref = `/r/${demo.retailerSlug}`;
  const portalHref = retailerAppUrl
    ? `${retailerAppUrl.replace(/\/$/, "")}/login?demo=1`
    : undefined;

  return (
    <RetailerTheme theme={demo.configuration.theme}>
      <main className="flex min-h-screen items-center justify-center bg-[var(--retailer-surface)] px-5 py-16 text-[var(--retailer-ink)]">
        <section className="w-full max-w-xl">
          <p className="text-xs uppercase tracking-[0.2em] opacity-45">
            Private demonstration · expires{" "}
            {new Date(demo.expiresAt).toLocaleDateString()}
          </p>
          <h1 className="mt-5 text-5xl font-[var(--font-retailer-display)] leading-none sm:text-6xl">
            {demo.companyName}
          </h1>
          <p className="mt-6 text-base leading-7 opacity-60">
            {demo.configuration.personalizedIntroduction}
          </p>
          <p className="mt-4 text-sm leading-6 opacity-50">
            {demo.configuration.marketingHeadline}
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href={storefrontHref}
              className="inline-flex min-h-12 items-center justify-center rounded-[var(--retailer-radius)] bg-[var(--retailer-accent)] px-6 text-sm text-white"
            >
              Open the storefront →
            </Link>
            {portalHref ? (
              <a
                href={portalHref}
                className="inline-flex min-h-12 items-center justify-center rounded-[var(--retailer-radius)] border border-black/15 px-6 text-sm"
              >
                Open Mission Control
              </a>
            ) : null}
          </div>
          <p className="mt-8 text-xs leading-5 opacity-40">
            You are entering a real seeded PAON tenant for this prospect — not a
            slideshow. The storefront is live at /r/{demo.retailerSlug}.
          </p>
        </section>
      </main>
    </RetailerTheme>
  );
}
