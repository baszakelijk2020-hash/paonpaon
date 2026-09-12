"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import "./overview.css";

/**
 * The pieces that make up today's highlight, each with its own button. The
 * hero piece is in the selection from the start; every other line adds to or
 * comes off the running total, shown inclusive of VAT.
 *
 * The price IS the button. There is no separate price column: what a piece
 * costs and the act of putting it in are the same thing to the reader, and
 * splitting them left the button saying "Add" next to a number it was about to
 * add. Pressing a piece that is already in takes it out again, the hero piece
 * included — `aria-pressed` carries that state.
 *
 * The whole row IS the button — thumbnail, copy and price are all inside one
 * <button>, so a press anywhere on the rectangle toggles the piece, and there
 * is one control per row for the keyboard and for a screen reader.
 */

type OutfitPiece = {
  id: string;
  name: string;
  material: string;
  priceEur: number;
  tags: string[];
  /** Product photo when there is one; otherwise the swatch colour stands in. */
  image?: string;
  swatch: string;
  hero?: boolean;
};

const OUTFIT: readonly OutfitPiece[] = [
  {
    id: "suit",
    name: "Ecru Silk Suit",
    material: "100% Silk by Ermenegildo Zegna",
    priceEur: 2349,
    tags: ["Full canvas", "Handmade"],
    image: "https://www.nebelspiegel.com/images/smaller/6054.webp",
    swatch: "#efe6d2",
    hero: true,
  },
  {
    id: "knit",
    name: "White Crew Neck Knit",
    material: "100% Sea Island Cotton",
    priceEur: 339,
    tags: ["Handmade"],
    swatch: "#f7f5f0",
  },
  {
    id: "tie",
    name: "Off-white Tie",
    material: "100% Mulberry Silk (Northern Italy)",
    priceEur: 149,
    tags: [],
    swatch: "#e8dfcc",
  },
  {
    id: "loafer",
    name: "Suede Plain Toe Loafer",
    material: "Calfskin Leather · Dark Brown",
    priceEur: 399,
    tags: ["Goodyear welt"],
    swatch: "#4a3728",
  },
];

const VAT_RATE = 0.21;

function euro(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function OutfitBreakdown() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(OUTFIT.filter((piece) => piece.hero).map((p) => p.id)),
  );

  const total = OUTFIT.filter((piece) => selected.has(piece.id)).reduce(
    (sum, piece) => sum + piece.priceEur,
    0,
  );

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="paon-outfit" aria-label="Today’s outfit">
      {/* No heading: the aria-label names the region, and the pieces speak
          for themselves. A title only cost the list its top 38px. */}
      <ul className="paon-outfit-list">
        {OUTFIT.map((piece) => {
          const inSelection = selected.has(piece.id);
          return (
            <li key={piece.id}>
              {/*
               * The whole row is one button. The price sits inside it as a
               * plain span styled like a pill, so wherever the pointer lands
               * on the rectangle — thumbnail, name, price — it is the same
               * press, and there is exactly one control per piece for the
               * keyboard and for a screen reader.
               */}
              <button
                type="button"
                className={[
                  "paon-outfit-piece",
                  inSelection ? "is-selected" : "",
                ].join(" ")}
                aria-pressed={inSelection}
                aria-label={`${inSelection ? "Remove" : "Add"} ${piece.name}, ${
                  inSelection ? "" : "+ "
                }${euro(piece.priceEur)}`}
                onClick={() => toggle(piece.id)}
              >
                <span
                  className="paon-outfit-thumb"
                  style={{ background: piece.swatch }}
                  aria-hidden="true"
                >
                  {piece.image ? (
                    <Image
                      src={piece.image}
                      alt=""
                      fill
                      unoptimized
                      sizes="64px"
                    />
                  ) : null}
                </span>
                <span className="paon-outfit-copy">
                  <span className="paon-outfit-name">{piece.name}</span>
                  <span className="paon-outfit-material">{piece.material}</span>
                  {piece.tags.length ? (
                    <span className="paon-outfit-tags">
                      {piece.tags.join(" · ")}
                    </span>
                  ) : null}
                </span>
                {/* "+" while the piece is still to be added; once it is in,
                    the pill just states what it costs. */}
                <span className="paon-outfit-toggle" aria-hidden="true">
                  {inSelection ? "" : "+ "}
                  {euro(piece.priceEur)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="paon-outfit-total">
        <span>
          Total incl. {Math.round(VAT_RATE * 100)}% VAT · {selected.size}{" "}
          {selected.size === 1 ? "piece" : "pieces"}
        </span>
        <strong>{euro(total)}</strong>
      </div>
      {/* The product panel's own checkout row: heart · Continue In-Store ·
          Add to Bag. One vocabulary for "take this further", wherever it
          appears. */}
      <div className="paon-outfit-actions">
        <Link
          href="/wishlist"
          className="paon-outfit-heart"
          aria-label="Save this outfit"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35 10.55 20.03C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35Z" />
          </svg>
        </Link>
        <Link href="/r/atelier-demo" className="paon-outfit-action">
          Continue In-Store
        </Link>
        <Link
          href="/r/atelier-demo/cart"
          className="paon-outfit-action paon-outfit-action-primary"
          aria-disabled={selected.size === 0}
        >
          Add to Bag
        </Link>
      </div>
    </section>
  );
}
