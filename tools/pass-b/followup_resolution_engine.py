"""
Pass-B follow-up: delivered resolution (Suitablee's WebGL canvas backing
store, Enzo's largest garment raster image) and a real engine ID for
Suitablee (grep actual script bundle bytes for library signatures,
not just filenames -- the earlier pass's script-name heuristic found
nothing because the bundle is minified).
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
from measure import start_chrome, stop_chrome, new_tab, close_tab, CDP, DISMISS_CONSENT_JS

RES_JS = """
(() => {
  const canvases = Array.from(document.querySelectorAll('canvas'));
  const canvasInfo = canvases.map(c => ({
    backingWidth: c.width, backingHeight: c.height,
    cssWidth: c.clientWidth, cssHeight: c.clientHeight,
  }));
  const imgs = Array.from(document.querySelectorAll('img'))
    .map(i => ({src: i.currentSrc || i.src, naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight}))
    .filter(i => i.naturalWidth > 200)
    .sort((a,b) => (b.naturalWidth*b.naturalHeight) - (a.naturalWidth*a.naturalHeight))
    .slice(0, 5);
  return JSON.stringify({canvasInfo, largestImages: imgs});
})()
"""


def run(name, url, script_grep_terms):
    proc = start_chrome()
    try:
        tab_id, ws_url = new_tab()
        cdp = CDP(ws_url)
        cdp.call("Page.enable")
        cdp.call("Network.enable")
        cdp.call("Runtime.enable")
        cdp.call("Page.navigate", {"url": url}, timeout=20)
        cdp.drain(8)
        cdp.call("Runtime.evaluate", {"expression": DISMISS_CONSENT_JS}, timeout=10)
        cdp.drain(20)

        res = cdp.call("Runtime.evaluate", {"expression": RES_JS, "returnByValue": True}, timeout=10)
        resolution = json.loads(res["result"]["result"]["value"])

        # Fetch script bundle bytes for the largest few Script responses and grep for engine signatures.
        script_urls = [r["url"] for r in cdp.responses.values()
                       if r.get("resourceType") == "Script" and r.get("url")]
        found = {}
        for su in script_urls[:15]:
            fetch_js = f"""
            fetch({json.dumps(su)}).then(r => r.text()).then(t => {{
                window.__pbtext = t.slice(0, 500000);
            }}).catch(e => {{ window.__pbtext = 'ERR:' + e; }});
            """
            cdp.call("Runtime.evaluate", {"expression": fetch_js}, timeout=10)
            cdp.drain(1.5)
            get_js = "window.__pbtext ? window.__pbtext.length : -1"
            r2 = cdp.call("Runtime.evaluate", {"expression": get_js, "returnByValue": True}, timeout=10)
            if not r2 or r2.get("result", {}).get("result", {}).get("value", -1) in (-1, None):
                continue
            check_js = "JSON.stringify(" + json.dumps(script_grep_terms) + ".filter(t => (window.__pbtext||'').toLowerCase().includes(t.toLowerCase())))"
            r3 = cdp.call("Runtime.evaluate", {"expression": check_js, "returnByValue": True}, timeout=10)
            try:
                hits = json.loads(r3["result"]["result"]["value"])
            except Exception:
                hits = []
            if hits:
                found[su] = hits

        close_tab(tab_id)
        return {"resolution": resolution, "engine_signature_hits": found, "scripts_checked": script_urls[:15]}
    finally:
        stop_chrome(proc)


if __name__ == "__main__":
    print("=== Suitablee (resolution + engine ID) ===", file=sys.stderr)
    r1 = run("suitablee", "https://suitablee.com/en/suit",
              ["three", "babylon", "playcanvas", "r15", "r16", "r17", "webglrenderer",
               "unity", "cocos", "filament", "verge3d", "model-viewer"])
    print(json.dumps(r1, indent=2))

    print("=== Enzo Custom (delivered resolution) ===", file=sys.stderr)
    r2 = run("enzo_custom", "https://enzocustom.com/customize/suit-2p", [])
    print(json.dumps(r2, indent=2))

    with open("/tmp/pass-b-followup.json", "w") as f:
        json.dump({"suitablee": r1, "enzo_custom": r2}, f, indent=2)
