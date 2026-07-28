import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // paon.html's own white-card-on-cream panels (e.g. #paon-basket-rect)
        // sit at 8px, not the 12px `--radius-lg` this used before.
        "rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white p-6",
        className,
      )}
      {...props}
    />
  );
}
