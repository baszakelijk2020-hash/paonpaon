"use client";

import type {
  CommercialFeature,
  ProspectDemoConfiguration,
  RetailerBrandTheme,
  SubscriptionPlan,
} from "@paon/domain";
import {
  DEFAULT_RETAILER_BRAND_THEME,
  formatProspectProductImageLine,
} from "@paon/domain";
import { RetailerTheme } from "@paon/ui/components/RetailerTheme";
import { useActionState, useState } from "react";

import { saveStudioConfiguration, type StudioActionState } from "./actions";

const initialState: StudioActionState = {};
const PRODUCT_MIX = [
  ["tailoring", "Tailoring"],
  ["formalwear", "Formalwear"],
  ["ready_to_wear", "Ready to wear"],
  ["accessories", "Accessories"],
  ["bridal", "Bridal"],
  ["made_to_measure", "Made to measure"],
] as const;

export function StudioForm({
  prospectId,
  companyName,
  plans,
  features,
  configuration,
}: {
  prospectId: string;
  companyName: string;
  plans: SubscriptionPlan[];
  features: CommercialFeature[];
  configuration: ProspectDemoConfiguration | null;
}) {
  const initialPlan =
    plans.find((plan) => plan.id === configuration?.planId) ??
    plans[1] ??
    plans[0]!;
  const [planId, setPlanId] = useState(initialPlan.id);
  const [theme, setTheme] = useState<RetailerBrandTheme>(
    configuration?.theme ?? DEFAULT_RETAILER_BRAND_THEME,
  );
  const boundAction = saveStudioConfiguration.bind(null, prospectId);
  const [state, action, pending] = useActionState(boundAction, initialState);
  const selectedPlan = plans.find((plan) => plan.id === planId) ?? initialPlan;
  const selectedFeatures =
    configuration?.featureKeys.length && configuration.planId === planId
      ? configuration.featureKeys
      : selectedPlan.includedFeatureKeys;
  const input =
    "mt-2 min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-3 text-sm";

  return (
    <form action={action} className="space-y-8">
      <div className="grid gap-8 xl:grid-cols-[1fr_0.8fr]">
        <div className="space-y-8">
          <section className="rounded-[var(--radius-md)] border bg-white p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
              01 · Commercial frame
            </p>
            <p className="mt-3 text-xs leading-5 text-[var(--color-stone-400)]">
              Pitch notes for the conversation — not applied to the live demo
              tenant yet.
            </p>
            <label className="mt-5 block text-sm">
              Recommended package
              <span className="text-[var(--color-stone-400)]">
                {" "}
                (pitch only)
              </span>
              <select
                className={input}
                name="planId"
                value={planId}
                onChange={(event) =>
                  setPlanId(event.target.value as typeof planId)
                }
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {features.map((feature) => (
                <label
                  key={`${planId}-${feature.key}`}
                  className="flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] border px-3 text-sm"
                >
                  <input
                    type="checkbox"
                    name="featureKeys"
                    value={feature.key}
                    defaultChecked={selectedFeatures.includes(feature.key)}
                  />
                  {feature.name}
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-[var(--radius-md)] border bg-white p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
              02 · Retailer identity
            </p>
            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              {(
                [
                  ["accentColor", "Accent"],
                  ["surfaceColor", "Surface"],
                  ["inkColor", "Ink"],
                ] as const
              ).map(([name, label]) => (
                <label key={name} className="text-sm">
                  {label}
                  <input
                    className="mt-2 h-12 w-full rounded-[var(--radius-md)] border p-1"
                    type="color"
                    name={name}
                    value={theme[name]}
                    onChange={(event) =>
                      setTheme((current) => ({
                        ...current,
                        [name]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              <label className="text-sm">
                Display
                <select
                  className={input}
                  name="displayFont"
                  value={theme.displayFont}
                  onChange={(event) =>
                    setTheme((current) => ({
                      ...current,
                      displayFont: event.target
                        .value as RetailerBrandTheme["displayFont"],
                    }))
                  }
                >
                  <option value="paon_editorial">PAON Editorial</option>
                  <option value="heritage">Heritage</option>
                  <option value="modern">Modern</option>
                </select>
              </label>
              <label className="text-sm">
                Body
                <select
                  className={input}
                  name="bodyFont"
                  defaultValue={theme.bodyFont}
                >
                  <option value="quiet_sans">Quiet sans</option>
                  <option value="humanist">Humanist</option>
                </select>
              </label>
              <label className="text-sm">
                Corners
                <select
                  className={input}
                  name="cornerStyle"
                  defaultValue={theme.cornerStyle}
                >
                  <option value="soft">Soft</option>
                  <option value="tailored">Tailored</option>
                  <option value="architectural">Architectural</option>
                </select>
              </label>
            </div>
            <div className="mt-5 grid gap-5">
              {(
                [
                  ["logoUrl", "Logo URL"],
                  ["faviconUrl", "Favicon URL"],
                  ["heroImageUrl", "Hero image URL"],
                ] as const
              ).map(([name, label]) => (
                <label key={name} className="text-sm">
                  {label}
                  <input
                    className={input}
                    type="url"
                    name={name}
                    defaultValue={theme[name] ?? ""}
                    placeholder="https://"
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-[var(--radius-md)] border bg-white p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
              03 · Story and assortment
            </p>
            <div className="mt-5 space-y-5">
              <label className="block text-sm">
                Demo headline
                <input
                  className={input}
                  name="marketingHeadline"
                  defaultValue={configuration?.marketingHeadline}
                  placeholder={`A composed client journey for ${companyName}`}
                  required
                />
              </label>
              <label className="block text-sm">
                Personalized introduction
                <textarea
                  className={`${input} min-h-32 py-3`}
                  name="personalizedIntroduction"
                  defaultValue={configuration?.personalizedIntroduction}
                  required
                />
              </label>
              <label className="block text-sm">
                Locations{" "}
                <span className="text-[var(--color-stone-400)]">
                  (Name | City | optional https photo)
                </span>
                <textarea
                  className={`${input} min-h-24 py-3`}
                  name="locations"
                  defaultValue={
                    configuration?.locations
                      .map((location) =>
                        [location.name, location.city, location.imageUrl ?? ""]
                          .filter((part, index) => index < 2 || part)
                          .join(" | "),
                      )
                      .join("\n") ?? "Flagship | London"
                  }
                  required
                />
              </label>
              <div>
                <p className="text-sm">Product mix</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {PRODUCT_MIX.map(([key, label]) => (
                    <label
                      key={key}
                      className="flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border px-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="productMix"
                        value={key}
                        defaultChecked={
                          configuration?.productMix.includes(key) ??
                          ["tailoring", "formalwear"].includes(key)
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <label className="block text-sm">
                Prospect garment photos{" "}
                <span className="text-[var(--color-stone-400)]">
                  (one line: https URL | optional garment name | optional
                  description — up to 24. Uploads above append here
                  automatically. Leave blank to keep shared demo catalogue
                  photography under their brand.)
                </span>
                <textarea
                  className={`${input} min-h-28 py-3 font-mono text-xs`}
                  name="productImageUrls"
                  defaultValue={
                    configuration?.productImageUrls
                      .map((stored) => formatProspectProductImageLine(stored))
                      .join("\n") ?? ""
                  }
                  placeholder="https://…/their-jacket.webp | Midnight dinner jacket | Evening formal"
                />
              </label>
              <label className="block text-sm">
                Version note
                <input
                  className={input}
                  name="changeNote"
                  placeholder="Initial researched configuration"
                  required
                />
              </label>
            </div>
          </section>
        </div>

        <aside className="xl:sticky xl:top-8 xl:self-start">
          <p className="mb-3 text-xs uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
            Shared component preview
          </p>
          <RetailerTheme
            theme={theme}
            className="overflow-hidden rounded-[var(--radius-md)] border shadow-[var(--shadow-elevated)]"
          >
            <div className="min-h-[38rem] p-6">
              <p className="text-xs uppercase tracking-[0.2em] opacity-50">
                {selectedPlan.name}
              </p>
              <h2 className="mt-16 text-5xl leading-none">{companyName}</h2>
              <p className="mt-5 text-sm leading-7 opacity-60">
                {configuration?.personalizedIntroduction ||
                  "A retailer-specific narrative will appear here using only safe, shared PAON components."}
              </p>
              <div className="mt-12 rounded-[var(--retailer-radius)] border bg-white/60 p-5">
                <p className="text-xs opacity-45">Today’s attention</p>
                <p className="mt-2 text-lg">Three fittings need preparation</p>
                <div className="mt-5 h-1 rounded-full bg-black/10">
                  <div className="h-full w-2/3 bg-[var(--retailer-accent)]" />
                </div>
              </div>
            </div>
          </RetailerTheme>
        </aside>
      </div>
      {state.error ? (
        <p
          className="bg-[var(--color-danger-500)]/10 rounded-[var(--radius-md)] p-3 text-sm text-[var(--color-danger-500)]"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p
          className="bg-[var(--color-success-500)]/10 rounded-[var(--radius-md)] p-3 text-sm text-[var(--color-stone-800)]"
          role="status"
        >
          {state.success}
        </p>
      ) : null}
      <div className="bg-[var(--color-stone-50)]/95 sticky bottom-0 z-20 -mx-4 mt-6 border-t border-[var(--color-stone-200)] px-4 py-4 backdrop-blur xl:static xl:mx-0 xl:border-0 xl:bg-transparent xl:px-0 xl:py-0 xl:backdrop-blur-none">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-[var(--radius-md)] bg-[var(--color-stone-900)] px-6 text-sm text-white disabled:opacity-50 xl:w-auto"
        >
          {pending ? "Saving version…" : "Save Demo Studio version"}
        </button>
      </div>
    </form>
  );
}
