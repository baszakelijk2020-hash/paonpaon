"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { useActionState, useState } from "react";

import {
  enrollPassword,
  requestEmailOtp,
  resendEmailOtp,
  signIn,
  type EmailOtpFormState,
  type PasswordEnrollmentFormState,
  type ResendEmailOtpFormState,
  type VerifyEmailOtpFormState,
  verifyEmailOtp,
} from "./actions";

const initial: EmailOtpFormState = { fieldErrors: {} };

export function EmailFirstForm({
  redirectTo,
}: {
  readonly redirectTo: string;
}) {
  const [state, formAction, isPending] = useActionState(
    requestEmailOtp,
    initial,
  );
  const [returnToEmail, setReturnToEmail] = useState(false);

  if (!returnToEmail && state.next === "password" && state.email) {
    return (
      <PasswordPanel
        email={state.email}
        redirectTo={redirectTo}
        onBack={() => setReturnToEmail(true)}
      />
    );
  }
  if (!returnToEmail && state.next === "verify-email" && state.email) {
    return (
      <CodePanel
        email={state.email}
        redirectTo={redirectTo}
        onBack={() => setReturnToEmail(true)}
      />
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={() => setReturnToEmail(false)}
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <FormField label="Email" htmlFor="email" error={state.fieldErrors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          invalid={!!state.fieldErrors.email}
          className="rounded-full"
        />
      </FormField>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        disabled={isPending}
        className="mt-2 w-full rounded-full"
      >
        {isPending ? "Continuing…" : "Continue"}
      </Button>
    </form>
  );
}

export function PasswordPanel({
  email,
  redirectTo,
  onBack,
}: {
  readonly email: string;
  readonly redirectTo: string;
  readonly onBack?: () => void;
}) {
  return (
    <form action={signIn} className="flex flex-col gap-5">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <p role="status" className="text-sm text-[var(--color-stone-700)]">
        Enter your password to continue.
      </p>
      <FormField label="Password" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-full"
        />
      </FormField>
      <Button type="submit" size="lg" className="w-full rounded-full">
        Sign in
      </Button>
      {onBack ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full rounded-full"
          onClick={onBack}
        >
          Back
        </Button>
      ) : null}
    </form>
  );
}

export function CodePanel({
  email,
  redirectTo,
  onBack,
}: {
  readonly email: string;
  readonly redirectTo: string;
  readonly onBack?: () => void;
}) {
  const [verification, verifyAction, isVerifying] = useActionState<
    VerifyEmailOtpFormState,
    FormData
  >(verifyEmailOtp, { verified: false });
  const [resend, resendAction, isResending] = useActionState<
    ResendEmailOtpFormState,
    FormData
  >(resendEmailOtp, { sent: false });

  if (verification.verified)
    return <PasswordEnrollmentForm redirectTo={redirectTo} />;

  return (
    <div className="flex flex-col gap-5">
      <p role="status" className="text-sm text-[var(--color-stone-700)]">
        Enter the 6-digit confirmation code sent to <strong>{email}</strong>.
      </p>
      <form action={verifyAction} className="flex flex-col gap-4">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <FormField label="6-digit confirmation code" htmlFor="token">
          <Input
            id="token"
            name="token"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            className="rounded-full"
          />
        </FormField>
        {verification.formError ? (
          <p role="alert" className="text-sm text-[var(--color-danger-500)]">
            {verification.formError}
          </p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          disabled={isVerifying}
          className="w-full rounded-full"
        >
          {isVerifying ? "Confirming…" : "Confirm email"}
        </Button>
      </form>
      <form action={resendAction} className="flex flex-col gap-3">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        {resend.formError ? (
          <p role="alert" className="text-sm text-[var(--color-danger-500)]">
            {resend.formError}
          </p>
        ) : null}
        {resend.sent ? (
          <p role="status" className="text-sm text-[var(--color-stone-700)]">
            A new confirmation code has been sent.
          </p>
        ) : null}
        <Button
          type="submit"
          variant="secondary"
          disabled={isResending}
          className="w-full rounded-full"
        >
          {isResending ? "Sending…" : "Send a new code"}
        </Button>
      </form>
      {onBack ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full rounded-full"
          onClick={onBack}
        >
          Back
        </Button>
      ) : null}
    </div>
  );
}

export function PasswordEnrollmentForm({
  redirectTo,
}: {
  readonly redirectTo: string;
}) {
  const [state, formAction, isPending] = useActionState<
    PasswordEnrollmentFormState,
    FormData
  >(enrollPassword, {});
  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <p role="status" className="text-sm text-[var(--color-stone-700)]">
        Your email is confirmed. Set a password to finish signing in.
      </p>
      <FormField label="New password" htmlFor="new-password">
        <Input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          className="rounded-full"
        />
      </FormField>
      <FormField label="Confirm password" htmlFor="confirm-password">
        <Input
          id="confirm-password"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          className="rounded-full"
        />
      </FormField>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        disabled={isPending}
        className="mt-2 w-full rounded-full"
      >
        {isPending ? "Setting password…" : "Set password"}
      </Button>
    </form>
  );
}
