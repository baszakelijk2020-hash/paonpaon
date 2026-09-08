import { AuthShell } from "@paon/ui/components/AuthShell";

import { UpdatePasswordForm } from "./update-password-form";

/** The recovery confirmation route establishes the temporary session before
 * landing here. The form itself also checks that session so this public URL is
 * safe to open directly. */
export default function UpdatePasswordPage() {
  return (
    <AuthShell
      eyebrow="Private client"
      persona="Password recovery"
      title="Choose a new password."
      description="Use at least 12 characters to secure your account."
      imageUrl="https://www.nebelspiegel.com/images/smaller/6088.webp"
      imageAlt="Tailored wool suit from the PAON collection"
      footer={
        <p>Your password will be changed immediately after submission.</p>
      }
    >
      <UpdatePasswordForm />
    </AuthShell>
  );
}
