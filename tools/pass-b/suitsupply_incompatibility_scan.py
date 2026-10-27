"""
R-09b (08_DECISIONS_AND_OPEN_RISKS.md) incompatibility-enforcement scan:
navigates to Suitsupply's live configurator's Jacket tab and scans for
disabled/incompatible elements, rather than guessing a specific blocked
fabric/construction pair in advance. Same headless-Chrome-over-CDP
method as tools/pass-b/measure.py.

Result from the 2026-08-19 run (see R-09b in 08_DECISIONS_AND_OPEN_
RISKS.md): reached the real Jacket tab (a named-style picker -- Havana/
Milano/Roma -- not a fabric grid) after two earlier click-targeting
misses (documented in the script's own commit history, not silently
dropped). No disabled/incompatible element was found. This is a limits-
of-generic-scanning result, not evidence that Suitsupply lacks
incompatibility enforcement -- a real conflict may only surface when a
specific known-likely-incompatible pair is actually selected, which this
pass never triggered. A future attempt should target one specific pair
deliberately rather than scan generically.
"""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
from measure import start_chrome, stop_chrome, new_tab, close_tab, CDP, DISMISS_CONSENT_JS

DISMISS_ANY_MODAL_JS = """
(() => {
  const words = ['start designing', 'get started', 'continue', 'close', 'skip', 'confirm'];
  const clickable = Array.from(document.querySelectorAll('button, a, [role="button"]'));
  for (const el of clickable) {
    const t = (el.textContent || '').trim().toLowerCase();
    if (words.includes(t)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) { el.click(); return t; }
    }
  }
  return null;
})()
"""

CLICK_TEXT_EXACT_JS = """
(wanted) => {
  const all = Array.from(document.querySelectorAll('*'));
  for (const el of all) {
    const t = (el.textContent || '').trim();
    if (t !== wanted) continue;
    if (el.children.length > 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    el.click();
    return {clicked: true, tag: el.tagName, rect: {x: r.x, y: r.y, w: r.width, h: r.height}};
  }
  return {clicked: false};
}
"""

FIND_DISABLED_SWATCHES_JS = """
(() => {
  const candidates = Array.from(document.querySelectorAll('button, [role="button"], a')).filter(el => {
    const r = el.getBoundingClientRect();
    return r.width > 30 && r.width < 250 && r.height > 30 && r.height < 250;
  });
  const disabled = candidates.filter(el => {
    if (el.disabled) return true;
    if (el.getAttribute('aria-disabled') === 'true') return true;
    const cls = (el.className || '').toString().toLowerCase();
    return cls.includes('disabled') || cls.includes('unavailable');
  });
  return JSON.stringify({
    title: document.title,
    activeTabHint: (document.querySelector('[aria-selected="true"]')||{}).textContent || '',
    candidateCount: candidates.length,
    disabledCount: disabled.length,
    disabledSamples: disabled.slice(0, 8).map(el => ({
      cls: (el.className||'').toString().slice(0,100),
      alt: (el.querySelector('img')||{}).alt || '',
      text: (el.textContent||'').trim().slice(0,40),
    })),
  });
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
    cdp.drain(3)
    for i in range(6):
        r = cdp.call("Runtime.evaluate", {"expression": DISMISS_ANY_MODAL_JS, "returnByValue": True}, timeout=10)
        val = r.get("result", {}).get("result", {}).get("value")
        if val is None:
            break
        cdp.drain(2)

    # Move mouse away from any hover-triggered tooltip area before clicking.
    cdp.call("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": 10, "y": 10})
    cdp.drain(1)

    click_js = f"({CLICK_TEXT_EXACT_JS})('Jacket')"
    r2 = cdp.call("Runtime.evaluate", {"expression": click_js, "returnByValue": True}, timeout=10)
    click_out = r2["result"]["result"]["value"]
    print("[incompat3] click Jacket tab result:", click_out)
    cdp.drain(3)

    r3 = cdp.call("Runtime.evaluate", {"expression": FIND_DISABLED_SWATCHES_JS, "returnByValue": True}, timeout=10)
    out = json.loads(r3["result"]["result"]["value"])
    print("[incompat3] Jacket tab scan:", json.dumps(out, indent=2))

    shot = cdp.call("Page.captureScreenshot", {"format": "png"}, timeout=15)
    if shot and "result" in shot:
        import base64
        with open("/tmp/pass-b-suitsupply-jacket-tab2.png", "wb") as f:
            f.write(base64.b64decode(shot["result"]["data"]))

    close_tab(tab_id)
finally:
    stop_chrome(proc)
print("[incompat3] DONE")
