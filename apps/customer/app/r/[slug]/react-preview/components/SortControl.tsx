"use client";

import styles from "../storefront-shell.module.css";

interface SortControlProps {
  sortBy: string;
  onSortChange: (sort: string) => void;
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

export function SortControl({ sortBy, onSortChange }: SortControlProps) {
  return (
    <div className={styles.sortControl}>
      <label htmlFor="sort-select" className={styles.sortLabel}>
        Sort By
      </label>
      <select
        id="sort-select"
        className={styles.sortSelect}
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value)}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
