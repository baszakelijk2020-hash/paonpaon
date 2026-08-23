import { DEMO_PASSWORD, getDemoPersona } from "@paon/database/demo-seed";
import { Button } from "@paon/ui/components/Button";

import { signIn } from "./actions";

const DEMO_PERSONA = getDemoPersona("platform-admin");

/**
 * The one-click front door: no credentials to type — submits straight to
 * the real `signIn` Server Action as the seeded platform administrator.
 * `QuickDemoLogin` below it is the "I want a different persona" fallback;
 * this is the default path. Same env gate as that component.
 */
export function MasterDemoLogin({
  redirectTo,
}: {
  redirectTo?: string | undefined;
}) {
  return (
    <form action={signIn} className="mb-6">
      <input type="hidden" name="email" value={DEMO_PERSONA.email} />
      <input type="hidden" name="password" value={DEMO_PASSWORD} />
      {redirectTo ? (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      ) : null}
      <Button type="submit" size="lg" className="w-full">
        Demo login — one click
      </Button>
      <p className="mt-2 text-center text-xs text-[var(--color-stone-500)]">
        Platform administrator — no credentials needed
      </p>
    </form>
  );
}
