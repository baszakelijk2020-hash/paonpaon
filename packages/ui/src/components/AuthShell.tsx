import type { ReactNode } from "react";

/** Short, true claims only — no fabricated compliance/security badges.
 * Each one is a real, load-bearing fact about how the platform actually
 * enforces access (see docs/DATABASE.md — RLS by retailerId — and the
 * alterations audit trail), not marketing filler. */
const DEFAULT_TRUST_SIGNALS = [
  "Invite-only — no self-serve signup",
  "Every record scoped to your retailer by row-level security",
  "Staff actions are attributed and logged",
];

export function AuthShell({
  eyebrow,
  title,
  description,
  imageUrl,
  imageAlt,
  persona,
  trustSignals = DEFAULT_TRUST_SIGNALS,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  /** Renders as a badge chip so a staff member never mistakes this for
   * the customer-facing sign-in — e.g. "Staff access". */
  persona: string;
  trustSignals?: string[];
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="grid min-h-screen bg-[var(--color-stone-50)] lg:grid-cols-[minmax(0,1.15fr)_minmax(28rem,.85fr)]">
      <section className="relative hidden min-h-screen overflow-hidden bg-black lg:block">
        <img
          src={imageUrl}
          alt={imageAlt}
          className="absolute inset-0 size-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.15)_0%,rgba(0,0,0,.05)_30%,rgba(0,0,0,.5)_70%,rgba(0,0,0,.85)_100%)]" />

        <span className="absolute left-12 top-12 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-white/80 backdrop-blur-2xl xl:left-16 xl:top-16">
          PAON · {persona}
        </span>

        <div className="absolute inset-x-0 bottom-0 p-12 xl:p-16">
          <p className="font-accent text-[8px] uppercase tracking-[0.2em] text-white/55">
            Private retail, beautifully operated
          </p>
          <p className="font-display mt-5 max-w-xl text-4xl leading-[1.08] text-white xl:text-5xl">
            {title}
          </p>
          <p className="mt-4 max-w-md text-sm leading-6 text-white/70">
            {description}
          </p>
          <ul className="mt-8 flex flex-col gap-2 border-t border-white/15 pt-6">
            {trustSignals.map((signal) => (
              <li
                key={signal}
                className="flex items-start gap-2 text-xs leading-5 text-white/60"
              >
                <span aria-hidden="true" className="mt-1 text-white/35">
                  —
                </span>
                {signal}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex min-h-screen items-center px-5 py-10 sm:px-10 lg:px-14 xl:px-20">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-10 flex items-center justify-between gap-3">
            <p className="font-display text-lg tracking-[0.16em] text-[var(--color-stone-900)]">
              PAON
            </p>
            <span className="font-accent inline-flex items-center gap-1.5 rounded-full border border-[var(--color-stone-200)] bg-[var(--color-stone-100)] px-3 py-1 text-[9px] uppercase tracking-[0.18em] text-[var(--color-stone-600)] lg:hidden">
              {persona}
            </span>
          </div>

          <div className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white p-6 shadow-[var(--shadow-elevated)] sm:p-8">
            <p className="font-accent hidden text-[8px] uppercase tracking-[0.2em] text-[var(--color-stone-500)] lg:block">
              {eyebrow}
            </p>
            <h1 className="font-display mt-0 text-3xl leading-none text-[var(--color-stone-900)] lg:mt-3">
              {title}
            </h1>
            <p className="mt-4 text-sm leading-6 text-[var(--color-stone-500)]">
              {description}
            </p>

            <div className="mt-7">{children}</div>
          </div>

          <div className="mt-6 border-t border-[var(--color-stone-200)] pt-5 text-xs leading-5 text-[var(--color-stone-500)]">
            {footer}
          </div>
        </div>
      </section>
    </main>
  );
}
