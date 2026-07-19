import type { ReactNode } from "react";

import { Label } from "./Label";

export interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  hint?: string;
  children: ReactNode;
}

/** Label + control + error/hint, the one shape every form field in the platform uses. */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  children,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-[var(--color-stone-500)]">{hint}</p>
      ) : null}
    </div>
  );
}
