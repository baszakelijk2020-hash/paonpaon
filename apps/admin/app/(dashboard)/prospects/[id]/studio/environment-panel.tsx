"use client";

import type { ProspectDemoEnvironment } from "@paon/domain";
import { useActionState, useState } from "react";

import {
  generateDemoEnvironment,
  type DemoEnvironmentActionState,
} from "./actions";

const initialState: DemoEnvironmentActionState = {};

export function EnvironmentPanel({
  prospectId,
  environment,
  customerAppUrl,
}: {
  prospectId: string;
  environment: ProspectDemoEnvironment | null;
  customerAppUrl?: string | undefined;
}) {
  const action = generateDemoEnvironment.bind(null, prospectId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [activeRole, setActiveRole] = useState(
    environment?.syntheticData.personas[0]?.key ?? "owner",
  );
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">(
    "desktop",
  );
  const persona = environment?.syntheticData.personas.find(
    (item) => item.key === activeRole,
  );
  const previewWidth =
    device === "desktop"
      ? "max-w-full"
      : device === "tablet"
        ? "max-w-[48rem]"
        : "max-w-[24.375rem]";

  return (
    <section className="rounded-[1.25rem] border bg-white p-6 sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
            04 · Isolated environment
          </p>
          <h2 className="font-display mt-2 text-3xl">
            Generate, review, then publish.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500">
            Every person, order and garment below is synthetic and stored only
            in this prospect environment—not in live retailer tables.
          </p>
        </div>
        {environment ? (
          <span className="rounded-full border px-3 py-1 text-xs capitalize">
            {environment.status}
          </span>
        ) : null}
      </div>

      <form
        action={formAction}
        className="mt-7 grid gap-4 rounded-xl bg-stone-100 p-5 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
      >
        <label className="text-sm">
          Private access code
          <input
            className="mt-2 min-h-11 w-full rounded-md border bg-white px-3"
            name="accessCode"
            type="password"
            minLength={6}
            required
          />
        </label>
        <label className="text-sm">
          Expires
          <select
            className="mt-2 min-h-11 w-full rounded-md border bg-white px-3"
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
          className="min-h-11 rounded-md bg-stone-900 px-5 text-sm text-white disabled:opacity-50"
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
        <p className="mt-3 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="mt-3 text-sm text-emerald-800" role="status">
          {state.success}
        </p>
      ) : null}

      {environment ? (
        <div className="mt-8 space-y-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex gap-2 overflow-x-auto">
              {environment.syntheticData.personas.map((item) => (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => setActiveRole(item.key)}
                  className={`min-h-11 whitespace-nowrap rounded-md px-3 text-xs ${
                    activeRole === item.key
                      ? "bg-stone-900 text-white"
                      : "border"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {(["desktop", "tablet", "mobile"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDevice(mode)}
                  className={`min-h-11 rounded-md px-3 text-xs capitalize ${
                    device === mode ? "bg-stone-200" : "border"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl bg-stone-200 p-4 sm:p-8">
            <div
              className={`mx-auto overflow-hidden rounded-xl bg-stone-900 text-white shadow-[var(--shadow-elevated)] transition-all ${previewWidth}`}
            >
              <div className="border-b border-white/10 px-5 py-4 text-xs text-white/45">
                {persona?.label} · synthetic preview
              </div>
              <div className="p-6 sm:p-9">
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">
                  What needs attention now
                </p>
                <h3 className="font-display mt-4 text-4xl leading-none">
                  {persona?.attention}
                </h3>
                <button className="mt-7 min-h-11 rounded-md bg-white px-4 text-sm text-black">
                  {persona?.primaryAction} →
                </button>
                <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Object.entries(environment.syntheticData.metrics).map(
                    ([label, value]) => (
                      <div key={label} className="rounded-lg bg-white/10 p-4">
                        <p className="text-[10px] text-white/45">{label}</p>
                        <p className="mt-2 text-lg">{value}</p>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-xl border p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium">
                Private link expires{" "}
                {new Date(environment.expiresAt).toLocaleDateString()}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-stone-500">
                {customerAppUrl
                  ? `${customerAppUrl}/demo/${environment.publicToken}`
                  : `/demo/${environment.publicToken}`}
              </p>
            </div>
            <p className="text-xs text-stone-500">
              Publication controls are shown outside the client preview.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-8 rounded-xl border border-dashed p-8 text-center">
          <p className="font-display text-2xl">
            No synthetic environment exists.
          </p>
          <p className="mt-2 text-sm text-stone-500">
            Save the configuration, then generate a revocable private preview.
          </p>
        </div>
      )}
    </section>
  );
}
