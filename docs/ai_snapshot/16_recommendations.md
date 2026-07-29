# 16 — Recommendations

**Snapshot date: 2026-07-29.**  
Recommendations are derived **only** from repository evidence (debt, ADRs,
PHASE, gaps). They do **not** expand the freeze by themselves — [PHASE.md](../PHASE.md)
still gates implementation.

## Highest priority architectural improvements

1. **Treat PHASE conversion surfaces as the reliability bar** — storefront,
   Demo Studio, marketing must be trustworthy for prospects (ADR-051).
2. **Re-verify provider wiring in the environments that demos use** — Stripe,
   Resend, Twilio, OpenAI were historically never live-executed; empty demos
   are conversion risk.
3. **Do not grow domain breadth** while freeze holds — wardrobe/metadata/AI
   pillars are documented destinations (ADR-056), not current build tickets.
4. **Preserve ADR-052** — do not “fix” storefront by rewriting founder HTML
   in Tailwind.

## Highest leverage infrastructure work (when allowed)

1. Credential + cron completeness for email/SMS (including newsletter schedule
   gap).
2. Demo Studio synthetic data path completeness (PROJECT_STATE incomplete note).
3. Post-pilot **Metadata Graph Phase 0–1** before any wardrobe twin (vision
   dependency order / ROADMAP Horizons) — heuristics are a known ceiling.
4. Migration/type regeneration discipline (ADR-044 lessons).

## Documentation improvements

1. Quarantine or archive root `ROADMAP.md` / `CURRENT_STATE.md` / dead `prisma/`.
2. Verification pass on [PROJECT_STATE.md](../PROJECT_STATE.md) (ADR-051).
3. Keep `docs/vision/` vs `docs/ai_snapshot/` roles distinct (destination vs
   as-built).
4. Resolve ADR-050: implement, supersede, or explicitly mark abandoned.
5. Index this snapshot in [docs/README.md](../README.md) Tier 2 (done with this
   change set).

## Domain realignment

1. Clarify `ProductionOrder`: persist + connector later, or stop implying it in
   product copy until tables exist.
2. Keep Collection ≠ Brand until wave-two Brand ADR.
3. Extend wardrobe features from `PhysicalGarment`, not revived customer fit
   profiles (ADR-016/055).

## Refactoring opportunities (non-urgent)

1. Consolidate session helpers toward `@paon/auth` to reduce per-app drift.
2. Inventory Server Actions for a discoverable map (optional; not a public API).
3. Remove or rename `_tmp-*` e2e specs.
4. Static check for accidental inline Supabase queries outside repositories.

## Superseded gate

The pilot-proof and PHASE-lift prerequisites in the 2026-07-29 snapshot were
satisfied by the founder's 2026-07-30 programme authorization. They no longer
block Metadata Graph, wardrobe, or advisor work. The only current dependencies
and blockers are in `PHASE.md`.
