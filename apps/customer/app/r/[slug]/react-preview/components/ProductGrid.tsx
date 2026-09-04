"use client";

import { useEffect, useRef } from "react";

import type { StorefrontPageEntry } from "../../storefront-page-data-types";
import styles from "../storefront-shell.module.css";

interface ProductGridProps {
  entries: StorefrontPageEntry[];
  onProductClick: (productId: string) => void;
}

export function ProductGrid({ entries, onProductClick }: ProductGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Setup IntersectionObserver for reveal animation
    const observer = new IntersectionObserver(
      (observerEntries) => {
        observerEntries.forEach((entry) => {
          if (entry.isIntersecting) {
            const card = entry.target as HTMLElement;
            if (!card.classList.contains("paon-product-grid-visible")) {
              card.classList.add("paon-product-grid-visible");
              card.classList.remove("paon-product-grid-waiting");
            }
          }
        });
      },
      {
        rootMargin: "160px 0px 160px 0px",
        threshold: 0.08,
      },
    );

    // Observe all cards
    const cards = containerRef.current.querySelectorAll(".grid-card");
    cards.forEach((card) => {
      card.classList.add("paon-product-grid-waiting");
      observer.observe(card);
    });

    return () => {
      observer.disconnect();
    };
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No products found</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} id="product-grid" className={styles.productGrid}>
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="grid-card paon-product-grid-waiting"
          onClick={() => onProductClick(entry.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              onProductClick(entry.id);
            }
          }}
        >
          <div className="grid-card-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={entry.img}
              alt={entry.name}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
            />
          </div>
          <div className="grid-card-overlay">
            <div className={styles.productInfo}>
              <h3 className={styles.productName}>{entry.name}</h3>
              <p className={styles.productPrice}>{entry.price}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
