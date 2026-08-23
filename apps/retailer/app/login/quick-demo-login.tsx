"use client";

import {
  DEMO_CANONICAL_PERSONAS,
  DEMO_PASSWORD,
} from "@paon/database/demo-seed";
import { useSearchParams } from "next/navigation";

import { signIn } from "./actions";

const PROSPECT_ROLES = [
  ["owner", "Owner"],
  ["manager", "Manager"],
  ["sales", "Sales"],
] as const;

/**
 * Dev-only one-click persona switcher — NODE_ENV-gated, never rendered
 * in a production build. Prefer ?email= from Demo Studio / private demo
 * so prospect tenants get their own owner/manager/sales buttons instead
 * of only the static Maison Dubois list.
 */
export function QuickDemoLogin({
  redirectTo,
}: {
  redirectTo?: string | undefined;
}) {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") ?? "";
  const prospectSlug = prospectSlugFromEmail(emailParam);

  const maisonPersonas = DEMO_CANONICAL_PERSONAS.filter(
    (login) => login.app === "retailer",
  );

  const prospectPersonas = prospectSlug
    ? PROSPECT_ROLES.map(([role, label]) => ({
        email: `contact+${prospectSlug}-${role}@nebelspiegel.com`,
        persona: label,
        retailer: prospectSlug,
      }))
    : [];

  const personas =
    prospectPersonas.length > 0 ? prospectPersonas : maisonPersonas;
  if (personas.length === 0) return null;

  return (
    <div className="mt-8 border-t border-dashed border-[var(--color-stone-300)] pt-6">
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-danger-500)]">
        Dev only — quick persona login
        {prospectSlug ? ` · ${prospectSlug}` : ""}
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

function prospectSlugFromEmail(email: string): string | null {
  const match =
    /^contact\+([a-z0-9-]+)-(?:owner|manager|sales|workshop)@nebelspiegel\.com$/i.exec(
      email.trim(),
    );
  if (!match?.[1]) return null;
  const slug = match[1];
  // Maison Dubois uses the same pattern — keep the static list for it.
  if (slug === "maison-dubois") return null;
  return slug;
}
