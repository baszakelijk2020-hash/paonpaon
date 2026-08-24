"use client";

import {
  DEMO_CANONICAL_PERSONAS,
  DEMO_PASSWORD,
} from "@paon/database/demo-seed";

import { signIn } from "./actions";

/**
 * Dev-only one-click persona switcher — deployment-tier gated by its parent,
 * never rendered in a real production environment. It deliberately exposes
 * only the canonical roster;
 * a URL parameter must never manufacture a login identity.
 */
export function QuickDemoLogin({
  redirectTo,
}: {
  redirectTo?: string | undefined;
}) {
  const personas = DEMO_CANONICAL_PERSONAS.filter(
    (login) => login.app === "retailer",
  );
  if (personas.length === 0) return null;

  return (
    <div className="mt-8 border-t border-dashed border-[var(--color-stone-300)] pt-6">
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-danger-500)]">
        Dev only — quick persona login
      </p>
      <div className="flex flex-wrap gap-2">
        {personas.map((login) => (
          <form key={login.email} action={signIn}>
            <input type="hidden" name="email" value={login.email} />
            <input type="hidden" name="password" value={DEMO_PASSWORD} />
            {redirectTo ? (
              <input type="hidden" name="redirectTo" value={redirectTo} />
            ) : null}
            <button
              type="submit"
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-1.5 text-xs text-[var(--color-stone-700)] transition-colors hover:border-[var(--color-stone-500)]"
            >
              {login.persona}
              {"retailer" in login && login.retailer
                ? ` · ${login.retailer}`
                : ""}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
