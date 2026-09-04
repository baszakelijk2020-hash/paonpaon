"use client";

import { QuickDemoLogin } from "./login/quick-demo-login";
import { SignInForm } from "./login/sign-in-form";

/**
 * One plain email+password form, styled to drop into a dark glass panel
 * or a plain light card — reused wherever a signed-out customer needs to
 * authenticate WITHOUT navigating away from what they were doing.
 * Originally built inline inside `(dashboard)/guest-portal-preview.tsx`
 * (this session); extracted so every mid-task auth prompt (cart,
 * booking, table-service, etc.) reuses the same component instead of
 * hard-navigating to /login and losing the customer's place.
 *
 * Deliberately just email+password (SignInForm), matching the plain
 * /login page — no magic-link toggle, no separate demo screen. The dev-
 * only QuickDemoLogin persona buttons stay for local testing.
 *
 * `onCancel` closes the prompt without signing in (e.g. "Back"/"×").
 * `redirectTo` is passed straight through — same contract as /login.
 */
const VARIANT_CLASSES = {
  // For dark/glass surfaces (dashboard guest preview, storefront overlays).
  dark: "border border-white/15 bg-white/10 backdrop-blur-2xl [&_button[type='submit']]:!rounded-[var(--radius-md)] [&_button[type='submit']]:!border [&_button[type='submit']]:!border-white/25 [&_button[type='submit']]:!bg-white/15 [&_button[type='submit']]:!text-white [&_button[type='submit']]:!backdrop-blur-xl hover:[&_button[type='submit']]:!bg-white/25 [&_input]:!rounded-[var(--radius-md)] [&_input]:!border-white/25 [&_input]:!bg-white/90 [&_input]:!px-5 [&_input]:!text-[var(--color-stone-900)] [&_input]:!backdrop-blur-xl [&_label]:!text-white/85",
  // For plain light-background pages (cart, product/appointment forms).
  light: "border border-[var(--color-stone-200)] bg-[var(--color-stone-50)]",
} as const;

const CANCEL_CLASSES = {
  dark: "text-white/60 hover:text-white/85",
  light: "text-[var(--color-stone-500)] hover:text-[var(--color-stone-800)]",
} as const;

export function InlineSignIn({
  redirectTo,
  onCancel,
  cancelLabel = "Back",
  variant = "dark",
}: {
  readonly redirectTo: string;
  readonly onCancel: () => void;
  readonly cancelLabel?: string;
  readonly variant?: "dark" | "light";
}) {
  return (
    <div
      className={`max-w-sm rounded-[var(--radius-md)] p-6 ${VARIANT_CLASSES[variant]}`}
    >
      <SignInForm redirectTo={redirectTo} />
      <QuickDemoLogin redirectTo={redirectTo} />
      <button
        type="button"
        onClick={onCancel}
        className={`mt-5 text-xs underline underline-offset-4 ${CANCEL_CLASSES[variant]}`}
      >
        {cancelLabel}
      </button>
    </div>
  );
}
