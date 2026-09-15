/**
 * The day's highlight: the look shown in the overview's middle column, and
 * the photograph whose own edge colour paints the two side columns.
 *
 * A plain module on purpose, with no "use client". The overview page is a
 * server component, and a server component that imports a plain constant
 * from a "use client" module receives a client reference rather than the
 * value — HIGHLIGHT.image came back undefined there, the page wrote
 * `--paon-ootd-image: url(undefined)`, and both side columns requested
 * /_next/static/chunks/undefined on every style recalculation instead of
 * painting the photograph's edge.
 */
export const HIGHLIGHT = {
  image: "https://www.nebelspiegel.com/images/smaller/6063.webp",
  alt: "Midnight blue double-breasted suit from the S/S 2026 collection",
  /* Short enough to finish above the rule: the pieces are listed in full in
     the third column, so the greeting only has to name the look. */
  copy: "Today's highlight is a midnight blue double-breasted, cut from S130 bi-stretch wool in a Solaro herringbone.",
};
