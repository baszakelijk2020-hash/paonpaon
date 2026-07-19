import { type LabelHTMLAttributes, forwardRef } from "react";

import { cn } from "../lib/cn";

export const Label = forwardRef<
  HTMLLabelElement,
  LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => {
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control -- htmlFor is required by every caller via LabelHTMLAttributes; the rule can't see that through a generic wrapper.
    <label
      ref={ref}
      className={cn(
        "text-sm font-medium text-[var(--color-stone-800)]",
        className,
      )}
      {...props}
    />
  );
});

Label.displayName = "Label";
