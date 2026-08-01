import type { ReactNode } from "react";

import { Label } from "./Label";

export interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  hint?: string;
  /**
   * Set for a COMPOSITE control — one made of several buttons or radios
   * rather than a single focusable input (see `DateTimePicker`).
   *
   * A `<label for>` may only point at one form control. Pointing it at a
   * composite's hidden value input names something nobody can reach, and
   * leaves the controls a user actually operates with no accessible name at
   * all. In that case the label is rendered as a plain caption with an id,
   * and the child group names itself with `aria-labelledby={`${htmlFor}-label`}`.
   */
  labelledGroup?: boolean;
  children: ReactNode;
}

/** Label + control + error/hint, the one shape every form field in the platform uses. */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  labelledGroup,
  children,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {labelledGroup ? (
        <span
          id={`${htmlFor}-label`}
          className="text-sm font-medium text-[var(--color-stone-800)]"
        >
          {label}
        </span>
      ) : (
        <Label htmlFor={htmlFor}>{label}</Label>
      )}
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
