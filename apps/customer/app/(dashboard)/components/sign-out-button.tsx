import { signOut } from "../actions";

/** Renders the existing `signOut` server action as a real control. Used both
 * in the top-nav trailing slot (desktop) and inline on the account page
 * (mobile, where the trailing slot is hidden) so it is reachable regardless
 * of viewport. */
export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut} className={className}>
      <button
        type="submit"
        className="flex h-full w-full items-center justify-center text-[12px] font-medium tracking-[0.01em] text-[var(--color-stone-600)] transition-colors duration-200 hover:bg-white/60 hover:text-[var(--customer-ink)] sm:px-3 sm:text-[13px]"
      >
        Sign out
      </button>
    </form>
  );
}
