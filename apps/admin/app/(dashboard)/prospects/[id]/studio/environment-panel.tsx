"use client";

import type { ProspectDemoEnvironment } from "@paon/domain";
import { useActionState, useEffect, useState } from "react";

import {
  generateDemoEnvironment,
  type DemoEnvironmentActionState,
} from "./actions";

const DEMO_PASSWORD = "Demo-PAON-2026!";
const initialState: DemoEnvironmentActionState = {};

function outreachStorageKey(prospectId: string) {
  return `paon-demo-outreach:${prospectId}`;
}

export function EnvironmentPanel({
  prospectId,
  environment,
  customerAppUrl,
  retailerAppUrl,
  contactEmail,
  initialOutreachPack,
}: {
  prospectId: string;
  environment: ProspectDemoEnvironment | null;
  customerAppUrl?: string | undefined;
  retailerAppUrl?: string | undefined;
  contactEmail: string;
  initialOutreachPack?: string | undefined;
}) {
  const action = generateDemoEnvironment.bind(null, prospectId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [copied, setCopied] = useState<string>();
  const [savedOutreachPack, setSavedOutreachPack] = useState<
    string | undefined
  >(initialOutreachPack);

  useEffect(() => {
    if (initialOutreachPack) setSavedOutreachPack(initialOutreachPack);
  }, [initialOutreachPack]);

  useEffect(() => {
    if (!state.outreachPack) return;
    setSavedOutreachPack(state.outreachPack);
    try {
      sessionStorage.setItem(
        outreachStorageKey(prospectId),
        state.outreachPack,
      );
    } catch {
      /* private mode */
    }
  }, [state.outreachPack, prospectId]);

  useEffect(() => {
    if (savedOutreachPack || initialOutreachPack) return;
    try {
      const stored = sessionStorage.getItem(outreachStorageKey(prospectId));
      if (stored) setSavedOutreachPack(stored);
    } catch {
      /* private mode */
    }
  }, [prospectId, savedOutreachPack, initialOutreachPack]);

  const outreachPack =
    state.outreachPack ?? savedOutreachPack ?? initialOutreachPack;

  const storefrontUrl =
    environment?.retailerSlug && customerAppUrl
      ? `${customerAppUrl}/r/${environment.retailerSlug}`
      : environment?.retailerSlug
        ? `/r/${environment.retailerSlug}`
        : null;
  const demoUrl = environment
    ? customerAppUrl
      ? `${customerAppUrl}/demo/${environment.publicToken}`
      : `/demo/${environment.publicToken}`
    : null;

  async function copyLogin(email: string, href: string) {
    await navigator.clipboard.writeText(`${email}\n${DEMO_PASSWORD}\n${href}`);
    setCopied(email);
    window.setTimeout(() => setCopied(undefined), 1800);
  }

  async function copyOutreachPack(pack: string) {
    await navigator.clipboard.writeText(pack);
    setCopied("outreach");
    window.setTimeout(() => setCopied(undefined), 1800);
  }

  function personaHref(persona: {
    app?: "retailer" | "customer" | undefined;
    email?: string | undefined;
  }) {
    const base = persona.app === "customer" ? customerAppUrl : retailerAppUrl;
    if (!persona.email) return storefrontUrl ?? "#";
    const origin = (base ?? "").replace(/\/$/, "");
    const email = encodeURIComponent(persona.email);
    return `${origin}/login?demo=1&email=${email}`;
  }

  return (
    <section className="rounded-[var(--radius-md)] border bg-white p-6 sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
            04 · Isolated environment
          </p>
          <h2 className="font-display mt-2 text-3xl">
            Generate, review, then publish.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-stone-500)]">
            Generation creates a real seeded retailer tenant for this prospect —
            storefront, client book, staff personas — then hands back live links
            and one-click demo logins.
          </p>
        </div>
        {environment ? (
          <span className="rounded-[var(--radius-md)] border px-3 py-1 text-xs capitalize">
            {environment.status}
          </span>
        ) : null}
      </div>

      <form
        action={formAction}
        className="mt-7 grid gap-4 rounded-[var(--radius-md)] bg-[var(--color-stone-100)] p-5 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
      >
        <label className="text-sm">
          Private access code
          <input
            className="mt-2 min-h-11 w-full rounded-[var(--radius-md)] border bg-white px-3 font-mono text-sm"
            name="accessCode"
            type="text"
            autoComplete="off"
            minLength={6}
            required
          />
        </label>
        <label className="text-sm">
          Expires
          <select
            className="mt-2 min-h-11 w-full rounded-[var(--radius-md)] border bg-white px-3"
            name="expiryDays"
            defaultValue="14"
          >
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
            <option value="60">60 days</option>
          </select>
        </label>
        <button
          className="min-h-11 rounded-[var(--radius-md)] bg-[var(--color-stone-900)] px-5 text-sm text-white disabled:opacity-50"
          type="submit"
          disabled={pending}
        >
          {pending
            ? "Generating…"
            : environment
              ? "Regenerate safely"
              : "Generate environment"}
        </button>
      </form>
      {state.error ? (
        <p className="mt-3 text-sm text-[var(--color-danger-500)]" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="mt-3 text-sm text-[var(--color-stone-800)]" role="status">
          {state.success}
        </p>
      ) : null}
      {outreachPack ? (
        <div className="bg-[var(--color-success-500)]/10 mt-4 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--color-stone-900)]">
              Outreach pack (includes the access code)
              {!state.outreachPack && !initialOutreachPack ? (
                <span className="text-[var(--color-stone-800)]/70 ml-2 text-xs font-normal">
                  restored from this browser session
                </span>
              ) : null}
              {!state.outreachPack && initialOutreachPack ? (
                <span className="text-[var(--color-stone-800)]/70 ml-2 text-xs font-normal">
                  restored from last generate
                </span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2">
              {state.prospectMailtoHref ? (
                <a
                  href={state.prospectMailtoHref}
                  className="inline-flex min-h-9 items-center rounded-[var(--radius-md)] bg-[var(--color-stone-900)] px-3 text-xs text-white"
                >
                  Email {contactEmail} →
                </a>
              ) : null}
              <button
                type="button"
                className="inline-flex min-h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-stone-300)] bg-white px-3 text-xs"
                onClick={() => copyOutreachPack(outreachPack)}
              >
                {copied === "outreach" ? "Copied" : "Copy outreach pack"}
              </button>
            </div>
          </div>
          <pre className="text-[var(--color-stone-900)]/80 mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-5">
            {outreachPack}
          </pre>
        </div>
      ) : null}

      {environment ? (
        <div className="mt-8 space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {storefrontUrl ? (
              <a
                href={storefrontUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-[var(--radius-md)] border p-5 transition hover:bg-[var(--color-stone-50)]"
              >
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
                  Live storefront
                </p>
                <p className="mt-2 font-medium">
                  /r/{environment.retailerSlug}
                </p>
                <p className="mt-1 break-all font-mono text-xs text-[var(--color-stone-500)]">
                  {storefrontUrl}
                </p>
              </a>
            ) : null}
            {demoUrl ? (
              <a
                href={demoUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-[var(--radius-md)] border p-5 transition hover:bg-[var(--color-stone-50)]"
              >
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
                  Private demo link
                </p>
                <p className="mt-2 font-medium">
                  Expires {new Date(environment.expiresAt).toLocaleDateString()}
                </p>
                <p className="mt-1 break-all font-mono text-xs text-[var(--color-stone-500)]">
                  {demoUrl}
                </p>
              </a>
            ) : null}
          </div>

          <div>
            <p className="text-sm font-medium text-[var(--color-stone-900)]">
              One-click persona logins
            </p>
            <p className="mt-1 text-xs text-[var(--color-stone-500)]">
              Password for every seeded persona: {DEMO_PASSWORD}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {environment.syntheticData.personas.map((persona) => {
                const href = personaHref(persona);
                return (
                  <article
                    key={persona.key}
                    className="flex flex-col justify-between rounded-[var(--radius-md)] border p-4"
                  >
                    <div>
                      <p className="font-medium">{persona.label}</p>
                      <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                        {persona.attention}
                      </p>
                      {persona.email ? (
                        <p className="mt-3 break-all font-mono text-[11px] text-[var(--color-stone-600)]">
                          {persona.email}
                        </p>
                      ) : (
                        <p className="mt-3 text-xs text-[var(--color-stone-400)]">
                          Regenerate to attach a seeded login email.
                        </p>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-9 items-center rounded-[var(--radius-md)] bg-[var(--color-stone-900)] px-3 text-xs text-white"
                      >
                        {persona.primaryAction} →
                      </a>
                      {persona.email ? (
                        <button
                          type="button"
                          className="inline-flex min-h-9 items-center rounded-[var(--radius-md)] border px-3 text-xs"
                          onClick={() => copyLogin(persona.email!, href)}
                        >
                          {copied === persona.email ? "Copied" : "Copy login"}
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-8 rounded-[var(--radius-md)] border border-dashed p-8 text-center">
          <p className="font-display text-2xl">
            No demo retailer has been generated.
          </p>
          <p className="mt-2 text-sm text-[var(--color-stone-500)]">
            Save the configuration, then generate a real seeded tenant and a
            revocable private preview.
          </p>
        </div>
      )}
    </section>
  );
}
