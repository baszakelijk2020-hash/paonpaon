# 07 — Metadata

**Snapshot date: 2026-07-29.**

## Does a metadata system exist?

**No.** There is **no** Universal Metadata Graph, concept ontology, assignment
tables, embeddings store, or enrichment pipeline in application code or
Postgres schema.

Grep across TS/SQL for symbols such as `MetadataConcept`, `MetadataGraph`,
`EntityMetadataAssignment`, `pgvector`, and catalog attribute tables returned
**no implementation matches** on this snapshot date.

What exists instead:

1. **Vision specification only:** [docs/vision/02_metadata_graph.md](../vision/02_metadata_graph.md)
   (status: architectural destination, not shipped; ADR-056).
2. **Ephemeral storefront heuristics:** category, colour, pattern, season
   derived in `apps/customer/app/r/[slug]/route.ts` from product name /
   description / image id keywords, then injected into HTML for client-side
   filters.
3. **Thin catalog fields:** `products` / `product_variants` columns such as
   name, description, status, image URLs, variant size/color strings,
   collections M2M — not a concept graph.
4. **Alterations garment categories:** enum-like `GARMENT_CATEGORIES` in
   domain production module (suit, jacket, …) for physical garments — not
   catalog metadata.

## Schema

N/A for metadata graph. Catalog tables only as in [04_database.md](./04_database.md).

## Implementation (heuristics)

| Location                              | Behavior                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `apps/customer/app/r/[slug]/route.ts` | `deriveColor`, `derivePattern`, `deriveSeason`, `canonicalCategoryFor`, etc. |
| `paon-template.html`                  | Client filter UI over injected facets                                        |

These values are **not persisted** as editable retailer metadata.

## Limitations

- Uneditable, non-auditable, non-multilingual facet source
- Invisible to AI recommendation beyond raw name/description strings
- Will conflict with any future Metadata Graph until displaced (ADR-056 records intent only)

## Relationships

None as a first-class system. Heuristics loosely couple catalog strings →
storefront UX only.
