# Feature Interaction Matrix

Audit-only deliverable. Maps the 16 product-relevant `packages/domain/src`
modules against each other (18 infrastructure/config modules —
`eslint-config`, `typescript-config`, `shared`, and narrow leaf utility
folders — are excluded as not product-interaction-bearing). Relationship
types: **W** writes to, **R** reads from, **D** structurally depends on
(import-level), **N** notifies, **E** enriches (adds evidence/context to
another module's records), **A** analytically consumes (rolls up into a
report/KPI without writing back).

Grounded in `ONTOLOGY_AUDIT.md`'s per-concept producer/consumer findings and
`SYSTEM_INTERACTION_AUDIT.md`'s workflow traces. Cells left blank indicate
no interaction found in this pass — not necessarily proof none exists, but
none was evidenced.

---

## Matrix

Rows write/enrich/notify the column. Read left-to-right: "customer **E**
intelligence" = customer module enriches intelligence module.

| ↓ writes/reads →                | customer | retailer/identity | commerce    | production (fit/alteration) | wardrobe       | intelligence | knowledge | engagement | corporate | loyalty | concierge | wedding | gifting | metadata | analytics  | ai (pkg) |
| ------------------------------- | -------- | ----------------- | ----------- | --------------------------- | -------------- | ------------ | --------- | ---------- | --------- | ------- | --------- | ------- | ------- | -------- | ---------- | -------- |
| **customer**                    | —        | R                 | D           | D                           | D              | E,W          | R         | D          | R         | D       | D         | D       | D       | —        | A          | —        |
| **retailer/identity**           | R        | —                 | R           | R                           | R              | R            | R         | R          | R         | R       | R         | R       | R       | R        | R          | —        |
| **commerce**                    | E,W      | R                 | —           | D                           | **W**          | A            | —         | —          | R         | **N**   | —         | —       | —       | —        | A          | —        |
| **production (fit/alteration)** | E,W      | R                 | D           | —                           | —              | E            | —         | N          | —         | —       | —         | —       | —       | —        | A          | —        |
| **wardrobe**                    | R        | R                 | R           | R                           | —              | A,E          | —         | —          | —         | —       | —         | —       | —       | R        | A          | —        |
| **intelligence**                | R,W      | R                 | R           | R                           | R              | —            | R         | R          | E         | —       | —         | —       | —       | R        | **A(gap)** | D        |
| **knowledge**                   | —        | R                 | —           | —                           | R(as consumer) | E            | —         | —          | —         | —       | —         | —       | —       | R        | —          | D        |
| **engagement**                  | R        | R                 | —           | R(N)                        | —              | E,W          | —         | —          | —         | —       | —         | R       | —       | —        | A          | —        |
| **corporate**                   | R        | R                 | R           | —                           | —              | E            | —         | —          | —         | —       | —         | —       | —       | —        | A          | —        |
| **loyalty**                     | R,W      | R                 | R(N)        | —                           | —              | —            | —         | —          | —         | —       | —         | —       | —       | —        | A          | —        |
| **concierge**                   | R,W      | R                 | R           | R                           | R              | E            | —         | —          | —         | —       | —         | —       | —       | —        | A          | —        |
| **wedding**                     | R,W      | R                 | R           | R                           | —              | E            | —         | R          | —         | R       | —         | —       | R       | —        | A          | —        |
| **gifting**                     | R,W      | R                 | R(no order) | —                           | —              | E            | —         | —          | —         | R       | —         | —       | —       | —        | A          | —        |
| **metadata**                    | —        | R                 | —           | —                           | R              | —            | R,D       | —          | —         | —       | —         | —       | —       | —        | —          | D        |
| **analytics**                   | A        | A                 | A           | A                           | A              | A            | A         | A          | A         | A       | A         | A       | A       | A        | —          | —        |
| **ai (pkg)**                    | D        | —                 | —           | —                           | —              | D,W          | D,W       | —          | —         | —       | —         | —       | —       | D,W      | —          | —        |

---

## Notable read/write concentration

- **`retailer`/`identity`** is read by every other module (as it must be —
  every table carries `retailer_id`), and writes to none. This is the
  correct shape for a tenant root, not a red flag.
- **`intelligence`** is the busiest hub: written to by `customer`,
  `commerce`, `production`, `engagement`, `concierge`, `wedding`,
  `gifting` (every module that produces a customer fact or evidence
  event), and reads from `knowledge`, `corporate`, `metadata`, plus
  structurally depends on the `ai` package. This matches its role as the
  House Memory aggregation point — see `ONTOLOGY_AUDIT.md` — and is
  intentional concentration, not accidental coupling: every write into it
  is a distinct, independently-triggered fact-capture event, not a shared
  mutable object multiple modules race to update.
- **`analytics`** only reads (marked **A** everywhere) and never writes
  back to any module — correct for a reporting/rollup layer, and confirms
  `ARCHITECTURE_AUDIT.md`'s finding that `analytics` has a repository but no
  domain type: it is architecturally a pure consumer, which is consistent
  with, not contradicted by, its current under-modeling.

## Flags

### Isolated modules

**None found among the 16 product modules.** Every one has at least one
inbound or outbound edge to another product module. (Among the excluded
infrastructure modules, `eslint-config`/`typescript-config` are correctly
isolated — they are build tooling, not product code.)

### Accidental coupling

**None found.** Every cross-module edge traced back to a documented,
intentional producer/consumer relationship in `ONTOLOGY_AUDIT.md` or
`SYSTEM_INTERACTION_AUDIT.md`. No module was found reading another's
internal state through an undocumented back door (all cross-module access
observed goes through the repository layer, per the boundary rule verified
in `ARCHITECTURE_AUDIT.md`).

### Circular ownership

**None found.** The dependency-direction check in `ARCHITECTURE_AUDIT.md`
(zero `@paon/database`/`@supabase` imports inside `packages/domain/src`)
rules out the most likely circular pattern at the package level. At the
module level, `intelligence` reads from many modules and is written to by
many modules, but never in a cycle where module A writes to `intelligence`
which writes back to module A for the same fact (e.g. `commerce` writes an
order-derived `CustomerFact`-adjacent evidence event into `intelligence`,
but `intelligence` does not write back into `orders`).

### Missing integration

| Gap                                                               | Consequence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `intelligence` → **A(gap)** into `analytics`                      | The richest evidence source in the system (House Memory / StyleProfile / CustomerFact) is not confirmed to roll up into `/analytics` KPIs at all — the KPI repository (`analytics-repository.ts`) was not traced deeply enough to confirm it queries `intelligence`-owned tables directly versus only `commerce`/`loyalty` tables. This is the same gap `SYSTEM_INTERACTION_AUDIT.md` Journey 7 identifies from the workflow side (KPI platform and forecasting depend on evidence that may not yet be plumbed into the reporting layer). Flagged as **unclear source of truth for KPIs**, not confirmed broken — a targeted trace of `analytics-repository.ts`'s actual queries would resolve this definitively and is recommended as routine engineering follow-up, not a founder question. |
| `corporate` ↔ **[proposed]** Relationship Graph                   | No edge exists yet because the Relationship Graph itself doesn't exist (`ONTOLOGY_AUDIT.md`) — tracked as a sequencing gap, not a matrix defect.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `loyalty` (`Referral`) ↔ `corporate` (BD introduction candidates) | No edge — these are two separate systems for adjacent concepts, per `ONTOLOGY_AUDIT.md`'s "Referrals and introductions" entry. Flagged as a possible missing integration _or_ an intentional separation — founder-confirmable, see `FOUNDER_QUESTIONS.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### Redundant integration

**None found.** No two modules were found independently implementing the
same producer/consumer relationship.

### Unclear source of truth

- **KPIs generally:** see "Missing integration" above — until
  `analytics-repository.ts`'s query sources are traced, it is unclear
  whether each of the 12 proposed KPIs (`docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md`
  §7) would read from a single canonical source or require new aggregation
  wiring per-KPI.
- **Mission Control:** as established in `ONTOLOGY_AUDIT.md`/
  `SYSTEM_INTERACTION_AUDIT.md`, the `/mission-control` route currently
  aggregates from `intelligence` (clienteling/advisor-brief) but is
  described in product documents as also owning workforce-scheduling
  (`identity`/roster) and content-publishing (`knowledge`/`engagement`)
  responsibilities that are not reflected as edges into a single module in
  this matrix, because no single module currently owns "Mission Control" as
  a concept — restated here as a matrix-shaped instance of the same
  founder question.

---

## Summary

Of the interaction categories the audit brief asks to flag (isolated
modules, accidental coupling, circular ownership, missing integration,
redundant integration, unclear source of truth), PAON's current module
graph shows **zero** instances of the first three (isolation, accidental
coupling, circularity) — a materially clean result — and **three** concrete,
narrow instances of the last three, all of which trace back to gaps already
identified from the ontology and workflow angles rather than being new
architectural defects. This corroborates `ONTOLOGY_AUDIT.md`'s top-line
finding: the module graph itself is coherent; the open questions are about
what is not yet built or not yet named, not about modules stepping on each
other.
