import Link from "next/link";

import { DemoLoginForm } from "./demo-login-form";
import { MagicLinkForm } from "./magic-link-form";
import { MasterDemoLogin } from "./master-demo-login";
import { QuickDemoLogin } from "./quick-demo-login";

/**
 * Vercel sets VERCEL_ENV per deployment target (production/preview/
 * development); NODE_ENV alone can't tell Preview apart from Production
 * since Vercel Preview builds also report NODE_ENV=production. Falling
 * back to NODE_ENV only applies off-Vercel (local dev, no VERCEL_ENV).
 */
const isRealProduction =
  process.env["VERCEL_ENV"] === "production" ||
  (!process.env["VERCEL_ENV"] && process.env.NODE_ENV === "production");

const ERROR_MESSAGES: Record<string, string> = {
  invalid_invite: "That sign-in link is invalid or has expired.",
  not_a_customer_account: "That account doesn't have Customer Portal access.",
  invalid_demo_credentials: "Those demo credentials could not be verified.",
};

/**
 * The real front door for shoppers (not the platform's B2B marketing site
 * at `(marketing)/page.tsx`) — a full-bleed video hero with translucent
 * glass panels, the same visual language as AmHouseHero
 * (`wedding-parties/[id]/am-house-hero.tsx`, pag1.html's "AM House
 * Party"/"Moonstruck" screen), founder-requested as a distinct consumer
 * lander (see docs/DECISIONS.md ADR-046/ADR-047).
 *
 * `MagicLinkForm`/`DemoLoginForm`/`QuickDemoLogin` are unmodified — same
 * labels, same accessible names, same Server Actions — only restyled from
 * the outside via arbitrary-variant descendant selectors on the wrapping
 * div (`[&_input]:...`, `[&_label]:...`), so the glass treatment
 * reaches the actual input/button instead of hiding the form in an opaque
 * card. Inputs and submit use `--radius-md` (paon.html), not pill chrome.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    demo?: string;
    error?: string;
    redirectTo?: string;
    email?: string;
  }>;
}) {
  const { demo, error, redirectTo = "/dashboard", email } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;
  const isDemo = demo === "1";
  const prefilledEmail =
    email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;

  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        poster="https://www.nebelspiegel.com/images/smaller/6088.webp"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-90"
      >
        <source src="https://nebelspiegel.com/images/munross2026.mp4" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/15 to-black/75" />

      <div className="relative flex min-h-screen flex-col justify-between px-5 pb-8 pt-12 sm:px-10 sm:pt-16">
        <span className="inline-flex w-fit items-center gap-2 rounded-[var(--radius-md)] border border-white/15 bg-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-white/80 backdrop-blur-2xl">
          PAON · {isDemo ? "Showcase access" : "Private client"}
        </span>

        <div className="mx-auto w-full max-w-md">
          <div className="rounded-[var(--radius-md)] border border-white/15 bg-white/10 p-6 backdrop-blur-2xl sm:p-8 [&_button[type='submit']]:!rounded-[var(--radius-md)] [&_button[type='submit']]:!border [&_button[type='submit']]:!border-white/25 [&_button[type='submit']]:!bg-white/15 [&_button[type='submit']]:!text-white [&_button[type='submit']]:!backdrop-blur-xl hover:[&_button[type='submit']]:!bg-white/25 [&_input]:!rounded-[var(--radius-md)] [&_input]:!border-white/25 [&_input]:!bg-white/90 [&_input]:!px-5 [&_input]:!text-[var(--color-stone-900)] [&_input]:!backdrop-blur-xl [&_label]:!text-white/85">
            <h1 className="font-display text-4xl leading-none text-white">
              Welcome back.
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
              Your pieces, fittings, conversations and private invitations—kept
              together, with the people who know you.
            </p>

            {errorMessage ? (
              <p
                role="alert"
                className="mt-5 border-l-2 border-[var(--color-danger-400)] pl-4 text-sm text-white"
              >
                {errorMessage}
              </p>
            ) : null}

            <div className="mt-6">
              {!isRealProduction ? (
                <MasterDemoLogin redirectTo={redirectTo} />
              ) : null}
              {isDemo && !isRealProduction ? (
                <DemoLoginForm
                  redirectTo={redirectTo}
                  {...(prefilledEmail ? { email: prefilledEmail } : {})}
                />
              ) : (
                <MagicLinkForm redirectTo={redirectTo} />
              )}
              {!isRealProduction ? (
                <QuickDemoLogin redirectTo={redirectTo} />
              ) : null}
            </div>

            <div className="mt-6 border-t border-white/15 pt-5 text-xs leading-5 text-white/70">
              {isDemo ? (
                <p>
                  Demo access is restricted to seeded showcase accounts.{" "}
                  <Link href="/login" className="underline underline-offset-4">
                    Use passwordless sign-in instead.
                  </Link>
                </p>
              ) : (
                <p>
                  No password needed — we&rsquo;ll email you a private sign-in
                  link.{" "}
                  <Link
                    href="/login?demo=1"
                    className="underline underline-offset-4"
                  >
                    Exploring a seeded demo?
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
