"use client";

/**
 * Compatibility export for the earlier email-first entry point.
 * The maintained flow lives in email-first-form and owns the visible
 * known-account password versus new-account confirmation branch.
 */
export {
  EmailFirstForm as EmailOtpForm,
  PasswordEnrollmentForm,
} from "./email-first-form";
