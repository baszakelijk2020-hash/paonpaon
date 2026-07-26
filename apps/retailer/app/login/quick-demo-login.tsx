import { DEMO_PASSWORD, DEMO_PERSONA_LOGINS } from "@paon/database/demo-seed";

import { signIn } from "./actions";

/**
 * Dev-only one-click persona switcher — NODE_ENV-gated, never rendered
 * in a production build. Submits straight to the real `signIn` action
 * with a seeded persona's credentials pre-filled, so trying out "what
 * does a workshop manager see" doesn't require typing an email/password
 * you had to look up separately. Temporary by design: delete this file
 * and its one call site in page.tsx once there's a better story for
 * exploring personas than the actual login form.
 */
export function QuickDemoLogin({
  redirectTo,
}: {
  redirectTo?: string | undefined;
}) {
  const personas = DEMO_PERSONA_LOGINS.filter(
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
              className="rounded-full border border-[var(--color-stone-300)] px-3 py-1.5 text-xs text-[var(--color-stone-700)] transition-colors hover:border-[var(--color-stone-500)]"
            >
              {login.persona}
              {login.retailer ? ` · ${login.retailer}` : ""}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
