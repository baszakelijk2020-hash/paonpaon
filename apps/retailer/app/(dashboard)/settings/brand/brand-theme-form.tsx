"use client";

import type { RetailerBrandTheme } from "@paon/domain";
import { RetailerTheme } from "@paon/ui/components/RetailerTheme";
import { useActionState, useState } from "react";

import { saveBrandTheme, type BrandThemeActionState } from "./actions";

const initialState: BrandThemeActionState = {};
const ASSET_FIELDS = [
  ["logoUrl", "Logo URL"],
  ["faviconUrl", "Favicon URL"],
  ["heroImageUrl", "Storefront hero image URL"],
] as const;
const COLOR_FIELDS = [
  ["accentColor", "Accent"],
  ["surfaceColor", "Surface"],
  ["inkColor", "Ink"],
] as const;

export function BrandThemeForm({
  initialTheme,
  retailerName,
}: {
  initialTheme: RetailerBrandTheme;
  retailerName: string;
}) {
  const [state, action, pending] = useActionState(saveBrandTheme, initialState);
  const [theme, setTheme] = useState(initialTheme);
  const field = (name: keyof RetailerBrandTheme, value: string) =>
    setTheme((current) => ({ ...current, [name]: value }));

  return (
    <form action={action} className="grid gap-8 xl:grid-cols-[1fr_0.85fr]">
      <div className="space-y-8 rounded-[1.25rem] border bg-white p-6 sm:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
            Curated assets
          </p>
          <div className="mt-5 grid gap-5">
            {ASSET_FIELDS.map(([name, label]) => (
              <label key={name} className="text-sm">
                {label}
                <input
                  className="mt-2 min-h-11 w-full rounded-md border px-3"
                  name={name}
                  type="url"
                  defaultValue={initialTheme[name] ?? ""}
                  placeholder="https://"
                />
                {state.fieldErrors?.[name]?.[0] ? (
                  <span className="mt-1 block text-xs text-red-700">
                    {state.fieldErrors[name]?.[0]}
                  </span>
                ) : null}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
            Validated color tokens
          </p>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            {COLOR_FIELDS.map(([name, label]) => (
              <label key={name} className="text-sm">
                {label}
                <input
                  className="mt-2 h-12 w-full cursor-pointer rounded-md border p-1"
                  name={name}
                  type="color"
                  value={theme[name]}
                  onChange={(event) => field(name, event.target.value)}
                />
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <label className="text-sm">
            Display typography
            <select
              className="mt-2 min-h-11 w-full rounded-md border px-3"
              name="displayFont"
              value={theme.displayFont}
              onChange={(event) => field("displayFont", event.target.value)}
            >
              <option value="paon_editorial">PAON Editorial</option>
              <option value="heritage">Heritage</option>
              <option value="modern">Modern</option>
            </select>
          </label>
          <label className="text-sm">
            Body typography
            <select
              className="mt-2 min-h-11 w-full rounded-md border px-3"
              name="bodyFont"
              value={theme.bodyFont}
              onChange={(event) => field("bodyFont", event.target.value)}
            >
              <option value="quiet_sans">Quiet sans</option>
              <option value="humanist">Humanist</option>
            </select>
          </label>
          <label className="text-sm">
            Corner character
            <select
              className="mt-2 min-h-11 w-full rounded-md border px-3"
              name="cornerStyle"
              value={theme.cornerStyle}
              onChange={(event) => field("cornerStyle", event.target.value)}
            >
              <option value="soft">Soft</option>
              <option value="tailored">Tailored</option>
              <option value="architectural">Architectural</option>
            </select>
          </label>
        </div>
        <label className="block text-sm">
          Version note
          <input
            className="mt-2 min-h-11 w-full rounded-md border px-3"
            name="changeNote"
            placeholder="What changed and why"
            required
          />
          {state.fieldErrors?.["changeNote"]?.[0] ? (
            <span className="mt-1 block text-xs text-red-700">
              {state.fieldErrors["changeNote"]?.[0]}
            </span>
          ) : null}
        </label>
        {state.error ? (
          <p
            className="rounded-md bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p
            className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900"
            role="status"
          >
            {state.success}
          </p>
        ) : null}
        <button
          className="min-h-11 rounded-md bg-stone-900 px-5 text-sm text-white disabled:opacity-50"
          type="submit"
          disabled={pending}
        >
          {pending ? "Publishing…" : "Publish brand version"}
        </button>
      </div>

      <div className="xl:sticky xl:top-8 xl:self-start">
        <p className="mb-3 text-xs uppercase tracking-[0.18em] text-stone-500">
          Live token preview
        </p>
        <RetailerTheme
          theme={theme}
          className="overflow-hidden rounded-[1.25rem] border shadow-[var(--shadow-elevated)]"
        >
          <div
            className="min-h-[32rem] bg-cover bg-center p-7"
            style={
              initialTheme.heroImageUrl
                ? { backgroundImage: `url(${initialTheme.heroImageUrl})` }
                : undefined
            }
          >
            <div className="bg-[var(--retailer-surface)]/90 rounded-[var(--retailer-radius)] p-7">
              <p className="text-xs uppercase tracking-[0.2em] opacity-55">
                Private appointment
              </p>
              <h2 className="mt-4 text-4xl">{retailerName}</h2>
              <p className="mt-4 text-sm leading-6 opacity-65">
                A composed fitting journey, shaped in your own identity while
                remaining unmistakably PAON.
              </p>
              <button
                type="button"
                className="mt-7 min-h-11 rounded-[var(--retailer-radius)] bg-[var(--retailer-accent)] px-5 text-sm text-white"
              >
                Request an appointment
              </button>
            </div>
          </div>
        </RetailerTheme>
      </div>
    </form>
  );
}
