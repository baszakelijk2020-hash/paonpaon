"use client";

/* eslint-disable @next/next/no-img-element -- remote artwork tinted with
   filter(); next/image adds nothing for these and cannot optimise them. */
import {
  type CSSProperties,
  type ReactNode,
  useActionState,
  useState,
} from "react";

import {
  requestEmailOtp,
  requestExistingEmailMagicLink,
  requestPasswordReset,
  registerEmailPassword,
  signIn,
  type EmailOtpFormState,
  type EmailLinkFormState,
  type RegistrationFormState,
} from "../../login/actions";
import { showStoreEnvironment } from "../environment-store";

import { GuestWardrobeBackdrop } from "./guest-wardrobe-backdrop";

const initialFormState: EmailOtpFormState = {
  fieldErrors: {},
};

const initialEmailLinkState: EmailLinkFormState = { sent: false };

const initialRegistrationState: RegistrationFormState = {
  fieldErrors: {},
  sent: false,
};

/** Matches the Store / Wardrobe context-switcher segments. */
const SWITCHER_LABEL: CSSProperties = {
  fontFamily: "GTBold3, Arial, sans-serif",
  fontSize: "7px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#8a8a87",
};

function AppleMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="relative -top-[2px] left-[1px] h-[24px] w-[24px] fill-current"
    >
      <path d="M17.05 12.54c-.03-3.14 2.56-4.66 2.68-4.73a5.76 5.76 0 0 0-4.54-2.45c-1.91-.2-3.76 1.14-4.74 1.14-1 0-2.5-1.12-4.12-1.08A6.05 6.05 0 0 0 1.24 8.5C-.95 12.3.68 17.87 2.78 20.94c1.05 1.5 2.27 3.18 3.87 3.12 1.56-.06 2.14-1 4.03-1 1.87 0 2.41 1 4.04.96 1.68-.03 2.73-1.5 3.74-3.02a12.46 12.46 0 0 0 1.7-3.45 5.34 5.34 0 0 1-3.11-5.01ZM13.94 3.34A5.55 5.55 0 0 0 15.22 0a5.65 5.65 0 0 0-3.63 1.9 5.28 5.28 0 0 0-1.32 3.2 4.67 4.67 0 0 0 3.67-1.76Z" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <img
      src="/paon-icons/google-white.png"
      alt=""
      aria-hidden="true"
      className="block shrink-0 object-contain"
      style={{
        width: "22px",
        height: "22px",
        minWidth: "22px",
        minHeight: "22px",
        maxWidth: "22px",
        maxHeight: "22px",
        position: "relative",
        left: "-1px",
        filter: "brightness(0) invert(1)",
      }}
    />
  );
}

/** The guest Wardrobe destination uses the established magic-link action. */
export function GuestPortalPreview({ backdrop }: { backdrop?: ReactNode }) {
  const [state, formAction, isPending] = useActionState(
    requestEmailOtp,
    initialFormState,
  );
  const [magicLinkState, magicLinkAction, isMagicLinkPending] = useActionState(
    requestExistingEmailMagicLink,
    initialEmailLinkState,
  );
  const [passwordResetState, passwordResetAction, isPasswordResetPending] =
    useActionState(requestPasswordReset, initialEmailLinkState);
  const [registrationState, registrationAction, isRegistrationPending] =
    useActionState(registerEmailPassword, initialRegistrationState);
  const [returnToEmail, setReturnToEmail] = useState(false);
  const isCredentialStep =
    !returnToEmail && (state.next === "password" || state.next === "register");

  return (
    <section
      data-guest-login
      className="relative h-dvh w-full overflow-hidden bg-transparent"
    >
      <style>{`@keyframes guestCredentialLabelEnter { from { opacity: 0; } to { opacity: 1; } }`}</style>
      {/* Blurred stand-in for the signed-in Overview tab. */}
      {backdrop ?? <GuestWardrobeBackdrop />}
      <div className="absolute inset-0 z-10 grid place-items-center px-[20px]">
        <div
          className={`relative w-full max-w-[360px] rounded-[18px] bg-[rgba(0,0,0,0.1)] px-[28px] py-[24px] shadow-[0_18px_60px_rgba(0,0,0,0.16)] ${
            state.next === "password" && !returnToEmail ? "" : "min-h-[332px]"
          }`}
          style={{
            ...(state.next === "password" && !returnToEmail
              ? { alignSelf: "start", marginTop: "calc(50vh - 166px)" }
              : {}),
            backdropFilter: "blur(20px) invert(1)",
            WebkitBackdropFilter: "blur(20px) invert(1)",
          }}
        >
          {isCredentialStep ? (
            <button
              type="button"
              onClick={() => setReturnToEmail(true)}
              aria-label="Back"
              style={{ position: "absolute", top: "12px", left: "14px" }}
              className="flex h-[24px] w-[24px] items-center justify-center rounded-full text-white transition hover:bg-white/[0.12]"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-[14px] w-[14px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m14 6-6 6 6 6" />
              </svg>
            </button>
          ) : null}
          <button
            type="button"
            onClick={showStoreEnvironment}
            aria-label="Close"
            style={{ position: "absolute", top: "12px", right: "14px" }}
            className="flex h-[24px] w-[24px] items-center justify-center rounded-full text-white transition hover:bg-white/[0.12]"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-[14px] w-[14px]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
          <h1
            className="text-center leading-none"
            style={{
              ...SWITCHER_LABEL,
              color: "#fff",
              marginTop: "-4px",
              // This is deliberately owned by the heading: flex reordering of
              // the social block must never pull the Apple pill into the title.
              marginBottom: "24px",
            }}
          >
            {state.next === "password" && !returnToEmail
              ? "Welcome back"
              : state.next === "register" && !returnToEmail
                ? "New customer"
                : "Register or Log in"}
          </h1>

          <div className="flex flex-col">
            {!returnToEmail && state.next === "password" ? (
              <div className="mt-0 animate-[guestCredentialLabelEnter_400ms_ease-out]">
                <form action={signIn}>
                  <input type="hidden" name="email" value={state.email ?? ""} />
                  <input type="hidden" name="redirectTo" value="/dashboard" />
                  <label className="sr-only" htmlFor="guest-wardrobe-password">
                    Password
                  </label>
                  <input
                    id="guest-wardrobe-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Password"
                    required
                    style={{ background: "#fff", border: 0, boxShadow: "none" }}
                    className="h-[48px] w-full rounded-full px-[20px] text-[14px] tracking-[0.01em] text-[#30312f] outline-none [font-family:OptimaKlein,serif] placeholder:text-[#979797]"
                  />
                  <button
                    type="submit"
                    style={{
                      background:
                        "linear-gradient(135deg, #808080 0%, #bfbfbf 100%)",
                    }}
                    className="mt-[10px] h-[48px] w-full rounded-full text-[14px] font-normal tracking-[0.01em] text-white transition [font-family:OptimaKlein,serif] hover:brightness-95"
                  >
                    Log in
                  </button>
                </form>
                <form action={passwordResetAction}>
                  <input type="hidden" name="email" value={state.email ?? ""} />
                  <button
                    type="submit"
                    disabled={isPasswordResetPending}
                    className="mx-auto mt-[8px] block text-[11px] text-white underline underline-offset-[2px] [font-family:OptimaKlein,serif] disabled:cursor-wait disabled:opacity-70"
                  >
                    {isPasswordResetPending ? "Sending…" : "Reset password"}
                  </button>
                </form>
                {passwordResetState.sent ? (
                  <p className="mt-[4px] text-center text-[10px] text-[#555654] [font-family:OptimaKlein,serif]">
                    Password reset email sent.
                  </p>
                ) : passwordResetState.formError ? (
                  <p
                    role="alert"
                    className="mt-[4px] text-center text-[10px] text-[#db3330] [font-family:OptimaKlein,serif]"
                  >
                    {passwordResetState.formError}
                  </p>
                ) : null}
                <form action={magicLinkAction}>
                  <input type="hidden" name="email" value={state.email ?? ""} />
                  <button
                    type="submit"
                    disabled={isMagicLinkPending}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff",
                    }}
                    className="mt-[10px] h-[48px] w-full rounded-full text-[14px] font-normal tracking-[0.01em] transition [font-family:OptimaKlein,serif] hover:bg-white/[0.12] disabled:cursor-wait disabled:opacity-70"
                  >
                    {isMagicLinkPending
                      ? "Sending…"
                      : "Email me a sign-in link"}
                  </button>
                </form>
                {magicLinkState.sent ? (
                  <p className="mt-[4px] text-center text-[10px] text-[#555654] [font-family:OptimaKlein,serif]">
                    Sign-in email sent.
                  </p>
                ) : magicLinkState.formError ? (
                  <p
                    role="alert"
                    className="mt-[4px] text-center text-[10px] text-[#db3330] [font-family:OptimaKlein,serif]"
                  >
                    {magicLinkState.formError}
                  </p>
                ) : null}
              </div>
            ) : !returnToEmail && state.next === "register" ? (
              <form
                action={registrationAction}
                className="mt-0 animate-[guestCredentialLabelEnter_400ms_ease-out]"
              >
                <input type="hidden" name="email" value={state.email ?? ""} />
                <label
                  className="sr-only"
                  htmlFor="guest-wardrobe-new-password"
                >
                  Set password
                </label>
                <input
                  id="guest-wardrobe-new-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Set password"
                  required
                  className="h-[48px] w-full rounded-full border-0 bg-white px-[20px] text-[14px] tracking-[0.01em] text-[#30312f] outline-none [font-family:OptimaKlein,serif] placeholder:text-[#979797]"
                />
                <label className="sr-only" htmlFor="guest-wardrobe-first-name">
                  First name
                </label>
                <input
                  id="guest-wardrobe-first-name"
                  name="firstName"
                  autoComplete="given-name"
                  placeholder="First name"
                  required
                  className="mt-[10px] h-[48px] w-full rounded-full border-0 bg-white px-[20px] text-[14px] tracking-[0.01em] text-[#30312f] outline-none [font-family:OptimaKlein,serif] placeholder:text-[#979797]"
                />
                <label className="sr-only" htmlFor="guest-wardrobe-last-name">
                  Last name
                </label>
                <input
                  id="guest-wardrobe-last-name"
                  name="lastName"
                  autoComplete="family-name"
                  placeholder="Last name"
                  required
                  className="mt-[10px] h-[48px] w-full rounded-full border-0 bg-white px-[20px] text-[14px] tracking-[0.01em] text-[#30312f] outline-none [font-family:OptimaKlein,serif] placeholder:text-[#979797]"
                />
                <label className="sr-only" htmlFor="guest-wardrobe-phone">
                  Phone number
                </label>
                <input
                  id="guest-wardrobe-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="Phone number"
                  required
                  className="mt-[10px] h-[48px] w-full rounded-full border-0 bg-white px-[20px] text-[14px] tracking-[0.01em] text-[#30312f] outline-none [font-family:OptimaKlein,serif] placeholder:text-[#979797]"
                />
                {Object.values(registrationState.fieldErrors)[0] ? (
                  <p
                    role="alert"
                    className="mt-[6px] text-[10px] text-[#db3330] [font-family:OptimaKlein,serif]"
                  >
                    {Object.values(registrationState.fieldErrors)[0]}
                  </p>
                ) : null}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "32px",
                    marginTop: "32px",
                  }}
                >
                  <label className="flex items-center gap-[8px] text-[11px] text-white [font-family:OptimaKlein,serif]">
                    <input
                      name="newsletterOptIn"
                      type="checkbox"
                      defaultChecked
                      className="h-[13px] w-[13px] accent-[#30312f]"
                    />
                    Sign me up for the newsletter
                  </label>
                  <button
                    type="submit"
                    disabled={isRegistrationPending}
                    className="h-[48px] w-full rounded-full bg-gradient-to-r from-white/50 to-white/75 text-[14px] font-normal tracking-[0.01em] text-white [font-family:OptimaKlein,serif] disabled:cursor-wait disabled:opacity-70"
                  >
                    {isRegistrationPending ? "Registering…" : "Register"}
                  </button>
                </div>
                {registrationState.sent ? (
                  <p className="mt-[4px] text-center text-[10px] text-[#555654] [font-family:OptimaKlein,serif]">
                    Check your email to confirm your account.
                  </p>
                ) : registrationState.formError ? (
                  <p
                    role="alert"
                    className="mt-[4px] text-center text-[10px] text-[#db3330] [font-family:OptimaKlein,serif]"
                  >
                    {registrationState.formError}
                  </p>
                ) : null}
              </form>
            ) : (
              <form
                action={formAction}
                onSubmit={() => setReturnToEmail(false)}
                className={`mt-0 translate-y-[3px] transition-opacity duration-[400ms] ${isPending ? "opacity-0" : "opacity-100"}`}
              >
                <input type="hidden" name="redirectTo" value="/dashboard" />
                <label className="sr-only" htmlFor="guest-wardrobe-email">
                  Email
                </label>
                <input
                  id="guest-wardrobe-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="email"
                  defaultValue={returnToEmail ? "" : state.email}
                  placeholder="Email"
                  aria-invalid={!!state.fieldErrors.email}
                  aria-describedby={
                    state.fieldErrors.email
                      ? "guest-wardrobe-email-error"
                      : undefined
                  }
                  required
                  style={{ background: "#fff", border: 0, boxShadow: "none" }}
                  className="h-[48px] w-full rounded-full px-[20px] text-[14px] tracking-[0.01em] text-[#30312f] outline-none [font-family:OptimaKlein,serif] placeholder:text-[#979797]"
                />
                {state.fieldErrors.email ? (
                  <p
                    id="guest-wardrobe-email-error"
                    role="alert"
                    className="mt-[8px] text-[14px] text-[#db3330]"
                  >
                    {state.fieldErrors.email}
                  </p>
                ) : null}
                {state.formError ? (
                  <p
                    role="alert"
                    className="mt-[8px] text-[14px] text-[#db3330]"
                  >
                    {state.formError}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={isPending}
                  style={{
                    display: "flex",
                    width: "100%",
                    height: "48px",
                    alignItems: "center",
                    justifyContent: "center",
                    border: 0,
                    borderRadius: "9999px",
                    background:
                      "linear-gradient(135deg, #808080 0%, #bfbfbf 100%)",
                  }}
                  className="mt-[10px] text-[14px] font-normal tracking-[0.01em] text-white transition-all duration-[400ms] [font-family:OptimaKlein,serif] hover:brightness-95 disabled:cursor-wait disabled:opacity-70"
                >
                  {isPending ? "Sending…" : "Continue"}
                </button>
              </form>
            )}

            {!isCredentialStep ? (
              <div className="order-first mt-0">
                <div className="space-y-[10px]">
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    aria-describedby="social-auth-unavailable"
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff",
                    }}
                    className="flex h-[48px] w-full items-center rounded-full px-[20px] text-[14px] tracking-[0.01em] transition-colors duration-[400ms] [font-family:OptimaKlein,serif] hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-100"
                  >
                    <span className="flex-1 text-left">
                      Continue with Apple
                    </span>
                    <AppleMark />
                  </button>
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    aria-describedby="social-auth-unavailable"
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff",
                    }}
                    className="flex h-[48px] w-full items-center rounded-full px-[20px] text-[14px] tracking-[0.01em] transition-colors duration-[400ms] [font-family:OptimaKlein,serif] hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-100"
                  >
                    <span className="flex-1 text-left">
                      Continue with Google
                    </span>
                    <GoogleMark />
                  </button>
                </div>
                <div
                  className="mb-[11.5px] mt-[15.5px] -translate-y-[0.5px] text-center"
                  style={{ ...SWITCHER_LABEL, color: "rgba(255,255,255,0.8)" }}
                  aria-hidden="true"
                >
                  or
                </div>
                <p
                  id="social-auth-unavailable"
                  style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    padding: 0,
                    margin: -1,
                    overflow: "hidden",
                    clip: "rect(0, 0, 0, 0)",
                    whiteSpace: "nowrap",
                    border: 0,
                  }}
                >
                  Apple and Google sign-in are not available.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
