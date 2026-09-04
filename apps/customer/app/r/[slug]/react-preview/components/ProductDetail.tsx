"use client";

import { useEffect, useState } from "react";

import type { StorefrontPageEntry } from "../../storefront-page-data-types";
import styles from "../storefront-shell.module.css";

interface ProductDetailProps {
  product: StorefrontPageEntry;
  slug: string;
  onClose: () => void;
}

function favoritesKey(slug: string) {
  return `paon-favorites:${slug}`;
}

function readFavorites(slug: string): string[] {
  try {
    const stored = window.localStorage.getItem(favoritesKey(slug));
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

export function ProductDetail({ product, slug, onClose }: ProductDetailProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsFavorite(readFavorites(slug).includes(product.id));
    setMessage(null);
  }, [product.id, slug]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function toggleFavorite() {
    const favorites = new Set(readFavorites(slug));
    if (favorites.has(product.id)) favorites.delete(product.id);
    else favorites.add(product.id);
    window.localStorage.setItem(
      favoritesKey(slug),
      JSON.stringify([...favorites]),
    );
    setIsFavorite(favorites.has(product.id));
  }

  async function addToBag() {
    if (!product.variantId || product.soldOut) return;
    setAdding(true);
    setMessage(null);
    try {
      const response = await fetch(`/r/${slug}/api/cart-add`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ variantId: product.variantId, kind: "product" }),
      });
      if (!response.ok) throw new Error("Could not add this item to your bag.");
      setMessage("Added to your bag.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not add this item to your bag.",
      );
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className={styles.detailBackdrop}>
      <section
        aria-label={product.name}
        className={styles.productDetail}
        role="dialog"
        aria-modal="true"
      >
        <button className={styles.detailClose} onClick={onClose} type="button">
          Close
        </button>
        <div className={styles.detailImageWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.detailImage}
            src={product.detailImg || product.img}
            alt={product.name}
          />
        </div>
        <div className={styles.detailInfo}>
          <p className={styles.detailBrand}>{product.brand}</p>
          <h2 className={styles.detailName}>{product.name}</h2>
          <p className={styles.detailPrice}>{product.price}</p>
          <p className={styles.detailDescription}>{product.description}</p>
          <dl className={styles.detailFacts}>
            {product.material ? (
              <>
                <dt>Material</dt>
                <dd>{product.material}</dd>
              </>
            ) : null}
            {product.color ? (
              <>
                <dt>Colour</dt>
                <dd>{product.color}</dd>
              </>
            ) : null}
            {product.pattern ? (
              <>
                <dt>Pattern</dt>
                <dd>{product.pattern}</dd>
              </>
            ) : null}
          </dl>
          <div className={styles.detailActions}>
            <button
              className={styles.detailFavorite}
              onClick={toggleFavorite}
              type="button"
            >
              {isFavorite ? "Saved" : "Save"}
            </button>
            <button
              className={styles.detailAdd}
              disabled={!product.variantId || product.soldOut || adding}
              onClick={addToBag}
              type="button"
            >
              {product.soldOut ? "Sold out" : adding ? "Adding…" : "Add to bag"}
            </button>
          </div>
          {message ? (
            <p aria-live="polite" className={styles.detailMessage}>
              {message}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
