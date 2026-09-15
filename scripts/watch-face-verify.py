#!/usr/bin/env python3
"""Integrity check for the founder-approved analogue watch face (13 Sep 2026).

    watch-face-verify.py           check; exit 1 and list what drifted
    watch-face-verify.py --hook    PostToolUse mode: silent when intact, a
                                   blocking notice when anything drifted
    watch-face-verify.py --write   re-baseline the locked snapshot (only after
                                   the founder has explicitly approved a change)

The lock covers analogue-clock.tsx, pearl-light.tsx (it moves the dial's
light) and every overview.css rule that mentions `paon-analogue`. It catches
changes made by any route — the PreToolUse guard only sees the obvious ones.
"""
import hashlib, json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DASH = ROOT / "apps/customer/app/(shell)/(dashboard)/dashboard"
LOCK = ROOT / "docs/evidence/locked/watch-face"
SUMS = LOCK / "SHA256SUMS"


def analogue_rules() -> bytes:
    css = (DASH / "overview.css").read_text()
    blocks = re.findall(r"[^{}]*\{[^{}]*\}", css)
    return ("\n\n".join(b.strip() for b in blocks if "paon-analogue" in b) + "\n").encode()


def current() -> dict:
    return {
        "analogue-clock.tsx": (DASH / "analogue-clock.tsx").read_bytes(),
        "pearl-light.tsx": (DASH / "pearl-light.tsx").read_bytes(),
        "analogue-rules.css": analogue_rules(),
    }


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def main() -> int:
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    now = current()
    if mode == "--write":
        LOCK.mkdir(parents=True, exist_ok=True)
        for name, data in now.items():
            (LOCK / name).write_bytes(data)
        SUMS.write_text("".join(f"{sha(d)}  {n}\n" for n, d in now.items()))
        print("watch face snapshot written:", LOCK.relative_to(ROOT))
        return 0
    if mode == "--hook":
        sys.stdin.read()
    locked = {}
    if SUMS.exists():
        for line in SUMS.read_text().splitlines():
            h, n = line.split("  ", 1)
            locked[n] = h
    drift = [n for n, d in now.items() if locked.get(n) != sha(d)]
    if not drift:
        return 0
    msg = (
        "LOCKED WATCH FACE CHANGED: " + ", ".join(drift) + " no longer match the "
        "founder-approved snapshot in docs/evidence/locked/watch-face/. Restore "
        "them from that snapshot unless the founder explicitly approved this "
        "exact change; if approved, re-baseline with "
        "`python3 scripts/watch-face-verify.py --write`."
    )
    if mode == "--hook":
        print(json.dumps({"decision": "block", "reason": msg, "systemMessage": "⚠ " + msg}))
        return 0
    print(msg, file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
