# 14 — Long-term product vision

**Status: architectural destination, not shipped.** Category ownership
and what PAON will never become. Not a work ticket — see
[PHASE.md](../PHASE.md) and [vision README](./README.md).

## 1. Problem / non-goals

**Problem.** Without a category claim, PAON is “another RetailOS with AI
features” and features sprawl.

**Category claim.** PAON is the lifelong **personal wardrobe intelligence**
system for clients of independent menswear houses — delivered as a RetailOS
those houses operate. Analogues: Apple Health (health), Strava (exercise),
YNAB (budgeting). Clothing life deserves the same seriousness.

**Non-goals as a company.** Not a vertically integrated chain website. Not
a marketplace. Not a general CRM for high-volume retail. Not a factory MES
or MTM measurement authority (NON_GOALS). Not brand-over-retailer tenancy
for wave one.

## 2. Bounded context and intended entities

The whole vision set. No additional entities here — this doc is the map.

## 3. Relationships to other pillars

```text
Metadata Graph (spine)
  → Discovery Commerce
  → Wardrobe Intelligence ← Lifestyle, Colour, Lifecycle, Memory
       → Scoring → Roadmap
       → Outfit Intelligence
       → Recommendation Engine → AI Style Advisor
       → Clienteling Cockpit
```

## 4. Consumer surfaces

- Customer: wardrobe, roadmap, advisor, scores, outfits
- Retailer: cockpit, catalog metadata, enrichment review
- Admin: platform taxonomy, AI quality, commercial

## 5. Data ownership and tenancy

Retailer remains system of record for commercial relationship; customer
gains agency over wardrobe narrative and memory with consent.

## 6. AI contracts

Platform-wide principle: **wardrobe quality first, revenue as consequence;
every recommendation explainable via metadata + wardrobe facts.**

## 7. Phased delivery (horizons)

The Horizons A–D in [ROADMAP.md](../ROADMAP.md) are historical. The active
Intelligence Platform dependencies and acceptance contracts live only in
[PHASE.md](../PHASE.md). No vision pillar reorders that queue.

## 8. Dependencies and programme boundaries

Vision docs remain design references. `PHASE.md` now authorizes the complete
programme in dependency order; this document neither adds work nor blocks an
authorized queue item.

## 9. Open research questions

Wave-two multi-brand Brand entity timing; whether wardrobe twin is
cross-house by default for the customer identity; regulatory treatment of
colour/biometric imagery by market.
