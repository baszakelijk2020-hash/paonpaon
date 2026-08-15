# PHASE checkbox candidates — evidence-only audit (t9c)

- Date: 2026-08-15
- HEAD: `2c88183398ba7a755672bdeac90fb42496a84a9e`
- Tranche set: the 16 ids with completion-evidence tranches (`docs/evidence/tranches/`)
- Method: read each `docs/evidence/runs/<id>.json`; locate the id's heading in `docs/PHASE.md`; classify. No checkbox was changed. No recommendation beyond the classification.

## Per-id facts

| id    | run status | run gitSha | PHASE.md line | checkbox | classification |
| ----- | ---------- | ---------- | ------------- | -------- | -------------- |
| 4.6   | passed     | 1eac9d8    | 2302          | `- [ ]`  | CANDIDATE      |
| 4.7   | passed     | 1eac9d8    | 2389          | `- [ ]`  | CANDIDATE      |
| 4.9   | passed     | 1eac9d8    | 2481          | `- [ ]`  | CANDIDATE      |
| 4.10  | passed     | 1eac9d8    | 2523          | `- [ ]`  | CANDIDATE      |
| 8.4   | passed     | 1eac9d8    | 3068          | `- [ ]`  | CANDIDATE      |
| 9.1   | passed     | 1eac9d8    | 3125          | `- [ ]`  | CANDIDATE      |
| 17.1  | passed     | 1eac9d8    | 5565          | `- [ ]`  | CANDIDATE      |
| 17.2  | failed     | 90edc7d    | 5681          | `- [ ]`  | BLOCKED        |
| 17.3  | passed     | 1eac9d8    | 5734          | `- [ ]`  | CANDIDATE      |
| 17.4  | passed     | 1eac9d8    | 5786          | `- [ ]`  | CANDIDATE      |
| 17.5  | passed     | 1eac9d8    | 5841          | `- [ ]`  | CANDIDATE      |
| 17.6  | passed     | 1eac9d8    | 5885          | `- [ ]`  | CANDIDATE      |
| 17.8  | passed     | 1eac9d8    | 5925          | `- [ ]`  | CANDIDATE      |
| 17.9  | failed     | 90edc7d    | 6025          | `- [ ]`  | BLOCKED        |
| 17.14 | failed     | 90edc7d    | 6489          | `- [ ]`  | BLOCKED        |
| 18.5  | passed     | 1eac9d8    | 6929          | `- [ ]`  | CANDIDATE      |

Notes:

- SHA `90edc7d` is a strict ancestor of HEAD (`git merge-base --is-ancestor`).
- The tranche files for 17.2/17.9/17.14 do not yet record a fresh `status=passed`.
- PHASE.md `- [x]` ALREADY: none of the 16 ids is currently checked.
- PHASE.md PARKED/DELETED markers: none of the 16 headings or their bodies match parked/deleted.
- No tranche artifact is missing: all 16 have a run JSON under `docs/evidence/runs/`.

## CANDIDATES

Run status `passed` in the committed run JSON, PHASE.md still unchecked, no parked/deleted marker:

- 4.6
- 4.7
- 4.9
- 4.10
- 8.4
- 9.1
- 17.1
- 17.3
- 17.4
- 17.5
- 17.6
- 17.8
- 18.5

## BLOCKED

Run JSON records `status=failed` (17.2, 17.9, 17.14). Artifacts exist, so no missing-artifact block; the committed run state is not passing.

## PARKED

No entry in this tranche set is marked parked or deleted in PHASE.md. None.
