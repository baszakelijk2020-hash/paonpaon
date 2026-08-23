import { DEMO_PASSWORD, getDemoPersona } from "@paon/database/demo-seed";
import { Button } from "@paon/ui/components/Button";

import { signInToDemo } from "./actions";

const DEMO_PERSONA = getDemoPersona("customer");

/**
 * The one-click front door: no persona to pick, no credentials to type —
 * submits straight to the real `signInToDemo` Server Action as a seeded
 * Maison Dubois customer. `QuickDemoLogin` below it is the "I want a
 * different persona" fallback; this is the default path. Same env gate as
 * that component.
 */
export function MasterDemoLogin({ redirectTo }: { redirectTo: string }) {
  return (
    <form action={signInToDemo} className="mb-6">
      <input type="hidden" name="email" value={DEMO_PERSONA.email} />
      <input type="hidden" name="password" value={DEMO_PASSWORD} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <Button type="submit" size="lg" className="w-full">
        Demo login — one click
      </Button>
      <p className="mt-2 text-center text-xs text-white/70">
        {DEMO_PERSONA.persona}, {DEMO_PERSONA.retailer} — no credentials needed
      </p>
    </form>
  );
}
