import { type VariantProps, cva } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "../lib/cn";

export const buttonVariants = cva(
  // paon.html's own buttons (.drf-btn, #paon-basket-rect) sit at 6-8px, not
  // the 4px `--radius-sm` this used before.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] text-sm font-medium transition-[background-color,color,transform] duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--color-ink-600)] text-white hover:bg-[var(--color-ink-700)] focus-visible:ring-[var(--color-ink-600)]",
        secondary:
          "bg-[var(--color-stone-100)] text-[var(--color-stone-900)] hover:bg-[var(--color-stone-200)] focus-visible:ring-[var(--color-stone-400)]",
        outline:
          "border border-[var(--color-stone-300)] bg-transparent text-[var(--color-stone-900)] hover:bg-[var(--color-stone-50)] focus-visible:ring-[var(--color-stone-400)]",
        ghost:
          "bg-transparent text-[var(--color-stone-900)] hover:bg-[var(--color-stone-100)] focus-visible:ring-[var(--color-stone-400)]",
        destructive:
          "bg-[var(--color-danger-500)] text-white hover:opacity-90 focus-visible:ring-[var(--color-danger-500)]",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
