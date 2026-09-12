"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

/** A sidebar row that knows when it is the current page, so its icon can glow. */
export function SidebarLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={className}
      aria-current={active ? "page" : undefined}
      data-active={active ? "true" : "false"}
    >
      {children}
    </Link>
  );
}
