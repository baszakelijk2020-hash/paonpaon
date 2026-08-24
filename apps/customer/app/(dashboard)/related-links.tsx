import Link from "next/link";

/** Since the top tab bar folds several pages under one tab (e.g. Capsule
 * lives under "My Wardrobe"), this keeps every folded page's sibling
 * reachable from its landing page instead of only by typing the URL. */
export function RelatedLinks({
  links,
}: {
  links: readonly { href: string; label: string }[];
}) {
  return (
    <div className="-mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-stone-500)]">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="underline underline-offset-2 hover:text-[var(--color-stone-900)]"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
