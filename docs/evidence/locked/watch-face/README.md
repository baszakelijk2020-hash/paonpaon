# Locked: the analogue watch face

Approved by the founder on 13 September 2026 ("the watch face by the way is
perfection"), with the instruction that it must never change without an
extra warning.

## What is locked

| File                 | What it holds                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| `analogue-clock.tsx` | The dial: day-date windows, cyclops, Nebel & Spiegel signature, pearl ground, sheen and rim, ticks, hands |
| `pearl-light.tsx`    | Moves the dial's light with the pointer (sheen travel, sweep turn, stop slide)                            |
| `analogue-rules.css` | Every `overview.css` rule mentioning `paon-analogue`, in source order                                     |
| `watch-face.png`     | The approved rendering at device scale                                                                    |

`SHA256SUMS` holds the hashes the checks compare against.

## How the lock works

- `scripts/watch-face-lock.sh` is a Claude Code PreToolUse hook. It stops and
  asks for confirmation before any edit to the watch files, any edit whose
  text names the watch, and any shell command that could rewrite them or
  discard the uncommitted working tree.
- `scripts/watch-face-verify.py --hook` runs after every edit or shell
  command. If anything above no longer matches `SHA256SUMS` — whatever route
  changed it — it blocks and reports the drift.
- To change the watch on purpose: the founder approves the exact change,
  then run `python3 scripts/watch-face-verify.py --write` to re-baseline.
