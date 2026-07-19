import { type SelectHTMLAttributes, forwardRef } from "react";

import { cn } from "../lib/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-10 w-full rounded-[var(--radius-sm)] border border-[var(--color-stone-300)] bg-white px-3 text-sm text-[var(--color-stone-900)] transition-colors duration-150 ease-[var(--ease-out-quiet)]",
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

Select.displayName = "Select";
