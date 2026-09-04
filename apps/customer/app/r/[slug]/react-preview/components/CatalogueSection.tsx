"use client";

import { useMemo, useState } from "react";

import type { StorefrontPageEntry } from "../../storefront-page-data-types";
import styles from "../storefront-shell.module.css";

import { CategoryFilter } from "./CategoryFilter";
import { ProductGrid } from "./ProductGrid";
import { SortControl } from "./SortControl";

interface CatalogueSectionProps {
  entries: readonly StorefrontPageEntry[];
  categoryNames: readonly string[];
  defaultCategory: string;
}

// Extract catalogue number from product ID for sorting
function catalogNumber(id: string): number {
  const match = /(\d+)$/.exec(String(id || ""));
  return match && match[1] ? parseInt(match[1], 10) : 0;
}

// Sort products by the selected sort order
function sortProducts(
  list: StorefrontPageEntry[],
  sortBy: string,
): StorefrontPageEntry[] {
  const copy = [...list];

  if (sortBy === "price-asc") {
    copy.sort((a, b) => (a.priceMinor || 0) - (b.priceMinor || 0));
  } else if (sortBy === "price-desc") {
    copy.sort((a, b) => (b.priceMinor || 0) - (a.priceMinor || 0));
  } else {
    // "newest" — sort by catalogue number (descending)
    copy.sort((a, b) => catalogNumber(b.id) - catalogNumber(a.id));
  }

  return copy;
}

// Filter products by category
function filterByCategory(
  list: readonly StorefrontPageEntry[],
  category: string,
): StorefrontPageEntry[] {
  return list.filter((entry) => entry.category === category);
}

export function CatalogueSection({
  entries,
  categoryNames,
  defaultCategory,
}: CatalogueSectionProps) {
  const [selectedCategory, setSelectedCategory] =
    useState<string>(defaultCategory);
  const [sortBy, setSortBy] = useState<string>("newest");
  // TODO: Wire selectedProduct to ProductDetail/MobileProductDetail components per contract
  const [selectedProduct, setSelectedProduct] =
    useState<StorefrontPageEntry | null>(null);
  // Reference selectedProduct to suppress unused variable warning; will be used when ProductDetail/MobileProductDetail integrated
  void selectedProduct;

  // Handle product click — currently just sets selectedProduct state,
  // will be wired to ProductDetail/MobileProductDetail per contract
  const handleProductClick = (productId: string) => {
    const product = entries.find((entry) => entry.id === productId);
    if (product) {
      setSelectedProduct(product);
    }
  };

  // Memoize filtered and sorted products to avoid unnecessary recalculations
  const filteredAndSortedEntries = useMemo(() => {
    const filtered = filterByCategory(entries, selectedCategory);
    return sortProducts(filtered, sortBy);
  }, [entries, selectedCategory, sortBy]);

  return (
    <div className={styles.catalogueSection}>
      <div className={styles.catalogueControls}>
        <CategoryFilter
          categories={categoryNames}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
        <SortControl sortBy={sortBy} onSortChange={setSortBy} />
      </div>

      <ProductGrid
        entries={filteredAndSortedEntries}
        onProductClick={handleProductClick}
      />
    </div>
  );
}
