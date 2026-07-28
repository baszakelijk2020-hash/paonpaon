import { type InputHTMLAttributes, forwardRef } from "react";

import { cn } from "../lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          // paon.html's own inputs (#paon-appt-name/email) are 8px with a
          // 1px solid var(--mid) border, not the 4px radius / stone-300
          // border this used before.
          "h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-3 text-sm text-[var(--color-stone-900)] transition-colors duration-150 ease-[var(--ease-out-quiet)] placeholder:text-[var(--color-stone-400)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink-600)] focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          invalid &&
            "border-[var(--color-danger-500)] focus-visible:ring-[var(--color-danger-500)]",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
