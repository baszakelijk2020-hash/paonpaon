# 09 — Search

**Snapshot date: 2026-07-29.**

## Search implementation

There is **no** dedicated search service, search index, Elasticsearch/OpenSearch,
Postgres full-text catalog search, or semantic/vector search in this repository.

### Catalog / storefront

1. Load active products for retailer (repository list).
2. Derive ephemeral facets in `apps/customer/app/r/[slug]/route.ts`.
3. Client-side filter/sort in `paon-template.html` (`applyProductFilters`,
   `productMatchesCatalogFilters`).

`ProductRepository` exposes find-by-id/slug/retailer — **no** text-search API.

### Portal list UIs

`SearchableCollection` (`@paon/ui`) filters already-loaded collections in the
browser (products, clients, orders, appointments, admin lists, etc.).

Messaging conversation list uses local filter code in retailer UI.

## Filtering

| Surface       | Mechanism                                                          |
| ------------- | ------------------------------------------------------------------ |
| Storefront    | Keyword-derived category/color/pattern/season + price/sort in HTML |
| Portal tables | Client substring / field filter via `SearchableCollection`         |

## Ranking

Storefront sort options are client-side over injected catalog (exact option
set lives in template JS). AI product recommendation ranks **outside** search
(LLM pick among candidates) — see [08_ai.md](./08_ai.md).

## Indexing

**None** for catalog search. Database indexes exist for relational integrity /
query performance in migrations, but not as a search index product.

## Semantic search

**Not present.**

## Limitations

- Does not scale to large catalogs without loading all products into the
  storefront document
- Facets are heuristic and non-persistent
- No typo tolerance, synonyms, or mill/weave concept search
- Staff list search is in-memory only after page load
