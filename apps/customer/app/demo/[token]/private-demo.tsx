"use client";

import { RetailerTheme } from "@paon/ui/components/RetailerTheme";
import Link from "next/link";
import { useActionState } from "react";

import { openPrivateDemo, type OpenDemoState } from "./actions";

const initialState: OpenDemoState = {};

export function PrivateDemo({
  publicToken,
  retailerAppUrl,
  preview,
}: {
  publicToken: string;
  retailerAppUrl?: string | undefined;
  preview?:
    | {
        companyName: string;
        marketingHeadline?: string | undefined;
        logoUrl?: string | undefined;
        heroImageUrl?: string | undefined;
        accentColor?: string | undefined;
        surfaceColor?: string | undefined;
        inkColor?: string | undefined;
      }
    | undefined;
}) {
  const action = openPrivateDemo.bind(null, publicToken);
  const [state, formAction, pending] = useActionState(action, initialState);
  const demo = state.demo;

  if (!demo) {
    const gateTheme = {
      accentColor: preview?.accentColor ?? "#1a1a1a",
      surfaceColor: preview?.surfaceColor ?? "#1a1a1a",
      inkColor: preview?.inkColor ?? "#f4f1ec",
      displayFont: "paon_editorial" as const,
      bodyFont: "quiet_sans" as const,
      cornerStyle: "soft" as const,
      ...(preview?.logoUrl ? { logoUrl: preview.logoUrl } : {}),
      ...(preview?.heroImageUrl ? { heroImageUrl: preview.heroImageUrl } : {}),
    };
    return (
      <RetailerTheme theme={gateTheme}>
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--retailer-surface)] px-5 py-16 text-[var(--retailer-ink)]">
          {preview?.heroImageUrl ? (
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 bg-cover bg-center opacity-35"
              style={{ backgroundImage: `url(${preview.heroImageUrl})` }}
            />
          ) : null}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-gradient-to-b from-black/70 via-black/55 to-black/80"
          />
          <section className="w-full max-w-lg rounded-[1.25rem] border border-white/15 bg-black/45 p-7 text-white backdrop-blur-xl sm:p-10">
            {preview?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.logoUrl}
                alt=""
                className="h-8 w-auto max-w-[10rem] object-contain"
              />
            ) : (
              <p className="font-display text-2xl tracking-[0.24em]">PAON</p>
            )}
            <p className="mt-12 text-xs uppercase tracking-[0.2em] text-white/45">
              Private demonstration
            </p>
            <h1 className="font-display mt-4 text-5xl leading-none">
              {preview?.companyName ?? "Enter the room."}
            </h1>
            <p className="mt-5 text-sm leading-6 text-white/55">
              {preview?.marketingHeadline ??
                "This retailer-specific environment is private and time-limited. Use the access code shared by PAON to open their live storefront."}
            </p>
            <form action={formAction} className="mt-8">
              <label className="text-xs text-white/55">
                Access code
                <input
                  className="mt-2 min-h-12 w-full rounded-md border border-white/20 bg-white/10 px-4 text-white"
                  name="accessCode"
                  type="text"
                  autoComplete="off"
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
      </RetailerTheme>
    );
  }

  const storefrontHref = `/r/${demo.retailerSlug}`;
  const ownerEmail = `contact+${demo.retailerSlug}-owner@nebelspiegel.com`;
  const customerEmail = `contact+${demo.retailerSlug}-isabelle@nebelspiegel.com`;
  const portalHref = retailerAppUrl
    ? `${retailerAppUrl.replace(/\/$/, "")}/login?demo=1&email=${encodeURIComponent(ownerEmail)}`
    : undefined;
  const weddingHref = `/login?demo=1&email=${encodeURIComponent(customerEmail)}&redirectTo=${encodeURIComponent("/wedding-parties")}`;
  const locations = demo.configuration.locations;
  const heroUrl = demo.configuration.theme.heroImageUrl;
  const logoUrl = demo.configuration.theme.logoUrl;

  return (
    <RetailerTheme theme={demo.configuration.theme}>
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--retailer-surface)] px-5 py-16 text-[var(--retailer-ink)]">
        {heroUrl ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-cover bg-center opacity-25"
            style={{ backgroundImage: `url(${heroUrl})` }}
          />
        ) : null}
        <section className="w-full max-w-xl">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="mb-8 h-10 w-auto max-w-[12rem] object-contain"
            />
          ) : null}
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
          {locations.length > 0 ? (
            <ul className="mt-6 space-y-3 text-sm leading-6 opacity-50">
              {locations.map((location) => (
                <li
                  key={`${location.name}-${location.city}`}
                  className="flex items-center gap-3"
                >
                  {location.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={location.imageUrl}
                      alt=""
                      className="h-12 w-12 rounded-md object-cover"
                    />
                  ) : null}
                  <span>
                    {location.name}
                    {location.city ? ` · ${location.city}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
            <Link
              href={weddingHref}
              className="inline-flex min-h-12 items-center justify-center rounded-[var(--retailer-radius)] border border-black/15 px-6 text-sm"
            >
              Open wedding parties
            </Link>
          </div>
          <p className="mt-8 text-xs leading-5 opacity-40">
            You are entering a real seeded PAON tenant for this prospect — not a
            slideshow. The storefront is live at /r/{demo.retailerSlug}. Demo
            password for every persona: Demo-PAON-2026!
          </p>
        </section>
      </main>
    </RetailerTheme>
  );
}
