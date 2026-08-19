"""
R-09 (08_DECISIONS_AND_OPEN_RISKS.md) interaction pass: drives one real
fabric-swatch click on Suitsupply's live configurator (the D-15 quality
bar itself), captures before/after screenshots, and diffs network
requests to see how an option change is actually served. Same headless-
Chrome-over-CDP method as tools/pass-b/measure.py -- throwaway profile,
killed after, no visible browser.

Usage:
    python3 tools/pass-b/suitsupply_interaction.py

Finding from the 2026-08-19 run (written up in 08_DECISIONS_AND_OPEN_
RISKS.md's R-09 row): a fabric click triggers ~40 new small per-component
image fetches (one per garment part: lapel, shoulder, pocket, buttons,
etc, `_R00/_R01/_R02` discrete-frame naming), not a monolithic re-render
or a client-side 3D recompute -- confirms R-07's passive "2D layers
client-side" finding via a live interaction. Screenshots and full
request list print to stdout; nothing is written to disk except the
before/after PNGs (session-local /tmp paths).
"""
import json, time, sys
import os
sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
from measure import start_chrome, stop_chrome, new_tab, close_tab, CDP, DISMISS_CONSENT_JS

DISMISS_MODAL_JS = """
(() => {
  const words = ['start designing', 'get started', 'continue', 'close', 'skip'];
  const clickable = Array.from(document.querySelectorAll('button, a, [role="button"]'));
  for (const el of clickable) {
    const t = (el.textContent || '').trim().toLowerCase();
    if (words.includes(t)) { el.click(); return t; }
  }
  return null;
})()
"""

CLICK_SWATCH_JS = """
(() => {
  const imgs = Array.from(document.querySelectorAll('img[alt*="cdn.suitsupply.com"]'));
  if (imgs.length < 2) return JSON.stringify({error: 'not enough swatches', found: imgs.length});
  // Click the second swatch (first may already be selected/active).
  const target = imgs[1];
  const label = target.closest('button, a, [role="button"]') || target;
  const alt = target.alt;
  label.click();
  return JSON.stringify({clicked: true, alt});
})()
"""

proc = start_chrome()
try:
    tab_id, ws_url = new_tab()
    cdp = CDP(ws_url)
    cdp.call("Page.enable")
    cdp.call("Network.enable")
    cdp.call("Runtime.enable")
    cdp.call("Page.navigate", {"url": "https://custommade.suitsupply.com/configurator"}, timeout=20)
    cdp.drain(8)
    cdp.call("Runtime.evaluate", {"expression": DISMISS_CONSENT_JS}, timeout=10)
    cdp.drain(4)
    r = cdp.call("Runtime.evaluate", {"expression": DISMISS_MODAL_JS, "returnByValue": True}, timeout=10)
    print("[interact] dismissed modal:", r.get("result", {}).get("result", {}).get("value"))
    cdp.drain(4)

    # Baseline screenshot before interaction.
    shot = cdp.call("Page.captureScreenshot", {"format": "png"}, timeout=15)
    if shot and "result" in shot:
        import base64
        with open("/tmp/pass-b-suitsupply-before.png", "wb") as f:
            f.write(base64.b64decode(shot["result"]["data"]))

    # Snapshot network requests seen so far, then click, then diff.
    seen_before = set(cdp.responses.keys())

    r2 = cdp.call("Runtime.evaluate", {"expression": CLICK_SWATCH_JS, "returnByValue": True}, timeout=10)
    click_result = r2.get("result", {}).get("result", {}).get("value")
    print("[interact] click result:", click_result)

    cdp.drain(6)  # let any re-render / network activity settle

    seen_after = set(cdp.responses.keys())
    new_ids = seen_after - seen_before
    new_requests = [cdp.responses[rid] for rid in new_ids if cdp.responses[rid].get("url")]
    print(f"[interact] {len(new_requests)} new network requests after click:")
    for req in sorted(new_requests, key=lambda r: r.get("url", "")):
        print(f"  [{req.get('resourceType')}] {req.get('url')} ({req.get('encodedDataLength', '?')} bytes)")

    shot2 = cdp.call("Page.captureScreenshot", {"format": "png"}, timeout=15)
    if shot2 and "result" in shot2:
        import base64
        with open("/tmp/pass-b-suitsupply-after.png", "wb") as f:
            f.write(base64.b64decode(shot2["result"]["data"]))

    close_tab(tab_id)
finally:
    stop_chrome(proc)
print("[interact] DONE")
