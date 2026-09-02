# Phase 20 integration map

## Merge order

1. `ad7ef02` — DeepSeek static-audit aggregate; documentation only; independent
   matrix review complete.
2. `fd9c16b` — DeepSeek proof index; documentation only; no product claim.
3. `d967434` with ancestor `7819396` — Digital Fitting Room; merge only the tip.
4. `4118202` — Profile/Overview/Orders batch; ancestors include `3325ee0`,
   `a256373`, and `38a99dd`; do not merge ancestors separately.
5. `5a087e0` then `b559653` — raw PDP DFR implementation then its evidence.
6. `55e6d01`, `fe91186`, `50bdf00`, `b49798b`, `86e45d0` — subsequent customer
   lane tips, each requiring changed-path and exact-SHA evidence review.

## Duplicate and review gates

| Commit | Disposition | Required gate |
| --- | --- | --- |
| `3325ee0`, `a256373`, `38a99dd` | ancestors of `4118202` | do not merge separately; refresh stale evidence |
| `4118202` | candidate | 20.28 rejected it as exact-proof batch pending reruns |
| `7819396` | ancestor of `d967434` | merge only `d967434` |
| `5a087e0` + `b559653` | candidate pair | 20.29 review accepted for integration review; rerun on final SHA |
| `6fa59c1`, `fd9c16b` | evidence only | retain as audit material, not product proof |

No integration is performed by this map.
