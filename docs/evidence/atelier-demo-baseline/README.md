# Atelier Demo — Storefront Baseline Evidence

Immutable, versioned baseline of the **Atelier Demo** storefront
(`Nebel & Spiegel`, retailer slug `atelier-demo`) as served by the customer
app's storefront route handler.

Purpose: a fixed reference point for later parity / regression comparison of
the founder-template storefront. Each baseline is a self-contained, dated,
git-SHA-stamped snapshot. Baselines are **append-only** — never edit a
published `vN-YYYY-MM-DD/` directory; add a new one.

## Versions

| Version | Date       | Git SHA (repo HEAD at capture)             | Notes                                                                                                                                                          |
| ------- | ---------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1      | 2026-08-26 | `24be9519d33fa69f3dd10e4547e34ce4a40ec74f` | Initial source-of-truth baseline. Live screenshots + measured timings not captured — see `v1-2026-08-26/screenshots/README.md` and `v1-2026-08-26/timings.md`. |

## Layout of a baseline directory

```
vN-YYYY-MM-DD/
├── BASELINE.md               Human-readable summary + version identity
├── baseline.json             Machine-readable: URLs, wiring, checkpoints
├── interaction-checklist.md  Interaction surface to exercise on every re-baseline
├── data-wiring-inventory.md  Every data source feeding the storefront
├── parity-checkpoints.md     Template ↔ injection ↔ founder-original invariants
├── timings.md                Timing fields + capture procedure
└── screenshots/
    ├── README.md             Capture procedure + status
    └── *.png                 Desktop / mobile captures (when captured)
```

## Scope boundary

This lane (`phase-20.3`, `claude-storefront-baseline`) is **read-only**. It
records the storefront as it exists at the stamped SHA. It does not modify the
storefront, customer app, seed data, fleet scripts, `docs/PHASE.md`, package
files, dependencies, migrations, or configuration, and it does not run builds.
