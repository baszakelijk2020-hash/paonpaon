import { Button } from "@paon/ui/components/Button";

export default function CustomerHomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-4 px-6">
      <p className="text-sm font-medium uppercase tracking-wide text-[var(--color-stone-500)]">
        Customer Portal
      </p>
      <h1 className="text-3xl font-medium text-[var(--color-stone-900)]">
        Your relationship with the house, in one place
      </h1>
      <p className="text-[var(--color-stone-600)]">
        Orders, production and alteration tracking, loyalty, referrals and
        appointments for customers. This app is scaffolding only — see{" "}
        <code>/docs/PRODUCT.md</code> for the full feature roadmap.
      </p>
      <Button variant="primary">Sign in</Button>
    </main>
  );
}
