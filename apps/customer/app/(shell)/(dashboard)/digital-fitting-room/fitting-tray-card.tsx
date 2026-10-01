"use client";

import { useState } from "react";

import { useActionRunner } from "./fitting-room-shared";
import type { ComposableItem, SaveableProduct } from "./fitting-room-types";
import { SLOT_LABELS } from "./fitting-room-types";
import {
  removeProductFromFittingRoom,
  saveProductToFittingRoom,
} from "./fitting-tray-actions";

type TrayFilter = "all" | "wardrobe" | "product";

const FILTERS: readonly { id: TrayFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "wardrobe", label: "Wardrobe" },
  { id: "product", label: "Favorites" },
];

/** The "Saved pieces" tray: compact natural-ratio tiles; tap to add a piece to
 * the current look. Never hidden, whatever state the portrait is in. */
export function FittingTrayCard({
  retailerId,
  items,
  favorites,
  selectedKeys,
  onToggle,
}: {
  retailerId: string;
  items: readonly ComposableItem[];
  favorites: readonly SaveableProduct[];
  selectedKeys: ReadonlySet<string>;
  onToggle: (key: string) => void;
}) {
  const [filter, setFilter] = useState<TrayFilter>("all");
  const [showMore, setShowMore] = useState(false);
  const { pending, error, run } = useActionRunner();

  const visible = items.filter(
    (item) => filter === "all" || item.kind === filter,
  );

  function save(product: SaveableProduct) {
    run(async () => {
      const result = await saveProductToFittingRoom(
        retailerId,
        product.variantId,
      );
      if (result.error) throw new Error(result.error);
    });
  }

  function remove(item: ComposableItem) {
    run(async () => {
      if (selectedKeys.has(item.key)) onToggle(item.key);
      const result = await removeProductFromFittingRoom(retailerId, item.id);
      if (result.error) throw new Error(result.error);
    });
  }

  return (
    <section
      id="fitting-room-tray"
      className="paon-fit-zone paon-fit-tray"
      aria-labelledby="fitting-room-tray-title"
    >
      <div className="paon-fit-zone-head">
        <h3 id="fitting-room-tray-title" className="paon-fit-label">
          Saved pieces
        </h3>
        <span className="paon-fit-count">{items.length}</span>
      </div>

      <div className="paon-fit-filters" role="group" aria-label="Show">
        {FILTERS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="paon-fit-filter"
            aria-pressed={filter === entry.id}
            onClick={() => setFilter(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="paon-fit-scroll">
        <div className="paon-fit-scroll-inner">
          {visible.length === 0 ? (
            <p className="paon-fit-empty">
              {items.length === 0
                ? "Nothing saved yet. Save catalogue pieces below or add garments to your wardrobe."
                : "Nothing here yet."}
            </p>
          ) : (
            <div className="paon-fit-tiles">
              {visible.map((item) => {
                const selected = selectedKeys.has(item.key);
                const kindLabel = item.suggestedSlotKind
                  ? SLOT_LABELS[item.suggestedSlotKind]
                  : item.kind === "wardrobe"
                    ? "Owned"
                    : "Favorite";
                return (
                  <div key={item.key} className="paon-fit-tile-wrap">
                    <button
                      type="button"
                      className="paon-fit-tile"
                      aria-pressed={selected}
                      title={`${item.label} (${kindLabel})`}
                      aria-label={`${selected ? "Remove" : "Add"} ${item.label} ${selected ? "from" : "to"} your look`}
                      onClick={() => onToggle(item.key)}
                    >
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt={item.label} />
                      ) : (
                        <span className="paon-fit-tile-fallback">
                          {item.label}
                        </span>
                      )}
                      {selected ? (
                        <span
                          className="paon-fit-tile-check"
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                      ) : null}
                    </button>
                    <span className="paon-fit-tile-name">{item.label}</span>
                    {item.kind === "product" ? (
                      <button
                        type="button"
                        className="paon-fit-tile-remove"
                        disabled={pending}
                        onClick={() => remove(item)}
                        aria-label={`Remove ${item.label} from favorites`}
                        title="Remove from favorites"
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {showMore ? (
            <div className="paon-fit-more">
              <p className="paon-fit-label">Save from the catalogue</p>
              {favorites.length === 0 ? (
                <p className="paon-fit-empty">
                  Every available piece is already saved.
                </p>
              ) : (
                <div className="paon-fit-tiles">
                  {favorites.map((product) => (
                    <div key={product.productId} className="paon-fit-tile-wrap">
                      <div className="paon-fit-tile" data-static>
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.imageUrl} alt={product.name} />
                        ) : (
                          <span className="paon-fit-tile-fallback">
                            {product.name}
                          </span>
                        )}
                      </div>
                      <span className="paon-fit-tile-name">{product.name}</span>
                      <button
                        type="button"
                        className="paon-fit-btn paon-fit-btn-small paon-fit-btn-block"
                        disabled={pending}
                        onClick={() => save(product)}
                      >
                        Save
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="paon-fit-error">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className="paon-fit-link"
        aria-expanded={showMore}
        onClick={() => setShowMore((current) => !current)}
      >
        {showMore ? "Hide the catalogue" : "Save more from the catalogue"}
      </button>
    </section>
  );
}
