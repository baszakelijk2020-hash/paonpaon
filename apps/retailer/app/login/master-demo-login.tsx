import { DEMO_PASSWORD } from "@paon/database/demo-seed";
import { Button } from "@paon/ui/components/Button";

import { signIn } from "./actions";

const DEMO_EMAIL = "contact+maison-dubois-owner@nebelspiegel.com";

/**
 * The one-click front door: no persona to pick, no credentials to type —
 * submits straight to the real `signIn` Server Action as the Maison Dubois
 * owner. `QuickDemoLogin` below it is the "I want a different persona"
 * fallback; this is the default path. Same env gate as that component.
 */
export function MasterDemoLogin({
  redirectTo,
}: {
  redirectTo?: string | undefined;
}) {
  return (
    <form action={signIn} className="mb-6">
      <input type="hidden" name="email" value={DEMO_EMAIL} />
      <input type="hidden" name="password" value={DEMO_PASSWORD} />
      {redirectTo ? (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      ) : null}
      <Button type="submit" size="lg" className="w-full">
        Demo login — one click
      </Button>
      <p className="mt-2 text-center text-xs text-[var(--color-stone-500)]">
        Owner, Maison Dubois — no credentials needed
      </p>
    </form>
  );
}
