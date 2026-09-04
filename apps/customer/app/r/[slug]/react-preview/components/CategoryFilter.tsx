"use client";

import styles from "../storefront-shell.module.css";

interface CategoryFilterProps {
  categories: readonly string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

// Display labels that match the dashboard sidebar
const CATEGORY_DISPLAY_LABELS: Record<string, string> = {
  Pants: "Trousers",
  Knits: "Knitwear",
};

export function CategoryFilter({
  categories,
  selectedCategory,
  onCategoryChange,
}: CategoryFilterProps) {
  return (
    <div className={styles.categoryFilter}>
      <div className={styles.categoryFilterLabel}>Collection</div>
      <div className={styles.categoryFilterButtons}>
        {categories.map((category) => (
          <button
            key={category}
            className={`${styles.categoryButton} ${
              selectedCategory === category ? styles.categoryButtonActive : ""
            }`}
            onClick={() => onCategoryChange(category)}
          >
            {CATEGORY_DISPLAY_LABELS[category] || category}
          </button>
        ))}
      </div>
    </div>
  );
}
