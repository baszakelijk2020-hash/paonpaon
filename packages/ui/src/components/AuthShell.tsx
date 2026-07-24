import type { ReactNode } from "react";

export function AuthShell({
  eyebrow,
  title,
  description,
  imageUrl,
  imageAlt,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
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
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.66))]" />
        <div className="absolute inset-x-0 bottom-0 p-12 xl:p-16">
          <p className="text-[8px] font-[var(--font-accent)] uppercase tracking-[0.2em] text-white/55">
            Private retail, beautifully operated
          </p>
          <p className="mt-5 max-w-xl text-4xl font-[var(--font-display)] leading-[1.08] text-white xl:text-5xl">
            Every fitting, relationship and promise held in one calm place.
          </p>
        </div>
      </section>

      <section className="flex min-h-screen items-center px-5 py-10 sm:px-10 lg:px-14 xl:px-20">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-10">
            <p className="text-lg font-[var(--font-display)] tracking-[0.16em] text-[var(--color-stone-900)]">
              PAON
            </p>
            <p className="mt-12 text-[8px] font-[var(--font-accent)] uppercase tracking-[0.2em] text-[var(--color-stone-500)]">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-4xl font-[var(--font-display)] leading-none text-[var(--color-stone-900)]">
              {title}
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[var(--color-stone-500)]">
              {description}
            </p>
          </div>

          {children}

          <div className="mt-6 border-t border-[var(--color-stone-200)] pt-5 text-xs leading-5 text-[var(--color-stone-500)]">
            {footer}
          </div>
        </div>
      </section>
    </main>
  );
}
