"use client";

import { type ReactNode, useMemo, useState } from "react";

/**
 * Client-side filter over an already-loaded list. Prefer this for
 * retailer/admin workbenches where the page payload is small enough
 * that a round-trip per keystroke would be pure overhead.
 */
export function SearchableCollection<T>({
  items,
  predicate,
  placeholder,
  label = "Search",
  empty,
  children,
}: {
  items: T[];
  predicate: (item: T, query: string) => boolean;
  placeholder: string;
  label?: string;
  empty?: ReactNode;
  children: (filtered: T[]) => ReactNode;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => predicate(item, q));
  }, [items, predicate, query]);

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-11 w-full max-w-md rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-stone-900)] focus-visible:ring-offset-2"
      />
      {filtered.length === 0 ? (empty ?? null) : children(filtered)}
    </div>
  );
}
