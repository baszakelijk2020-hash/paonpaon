import { type VariantProps, cva } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";

export const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-[var(--color-stone-100)] text-[var(--color-stone-700)]",
        success:
          "bg-[var(--color-success-500)]/15 text-[var(--color-success-500)]",
        warning:
          "bg-[var(--color-warning-500)]/15 text-[var(--color-warning-500)]",
        danger:
          "bg-[var(--color-danger-500)]/15 text-[var(--color-danger-500)]",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, className }))} {...props} />;
}
