"""
Pass-B measurement harness: drive headless Chrome over CDP (throwaway
profile, killed after each site), navigate to a URL, and record:
  - rendering medium: canvas/WebGL element count + detected 3D library
  - per-asset network weight (encoded bytes) by resource type
  - total transferred bytes
  - a screenshot for the evidence record

11_EXECUTION_STATE.md's Work queue: "Measure the rejected configurators
... Use the Pass-B method -- ordinary Chrome over CDP, headless, and kill
it afterward." No prior script exists in the repo; this is that script.

Usage:
    pip3 install websocket-client   # only external dependency
    python3 tools/pass-b/measure.py [site_name ...]   # default: all sites

Requires Google Chrome at the path in CHROME below (macOS default location).
Writes a screenshot per site to /tmp/pass-b-<name>.png and the combined
JSON result to /tmp/pass-b-results.json. Findings from the 2026-08-19 run
are written up in 06_VISUAL_QUALITY_AND_ACCEPTANCE.md's "Measured" section
-- including this measurement's real limits (settle-window length, sites
whose given URL isn't the actual configurator surface, bot/geo/cert
blocks). Read those limits before trusting a "no canvas detected" result
as more than "not detected under this pass."
"""
import json
import subprocess
import sys
import time
import urllib.request
import uuid
import os

import websocket

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT = 9333
PROFILE_DIR = "/tmp/pass-b-chrome-profile"


def start_chrome():
    subprocess.run(["pkill", "-f", f"remote-debugging-port={PORT}"], capture_output=True)
    time.sleep(0.5)
    subprocess.run(["rm", "-rf", PROFILE_DIR], capture_output=True)
    os.makedirs(PROFILE_DIR, exist_ok=True)
    proc = subprocess.Popen([
        CHROME,
        "--headless=new",
        f"--remote-debugging-port={PORT}",
        "--remote-allow-origins=*",
        f"--user-data-dir={PROFILE_DIR}",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--window-size=1600,2000",
        "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version", timeout=0.5)
            return proc
        except Exception:
            time.sleep(0.25)
    raise RuntimeError("Chrome CDP endpoint never came up")


def stop_chrome(proc):
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
    subprocess.run(["rm", "-rf", PROFILE_DIR], capture_output=True)


def new_tab():
    req = urllib.request.Request(f"http://127.0.0.1:{PORT}/json/new?about:blank", method="PUT")
    data = json.loads(urllib.request.urlopen(req, timeout=5).read())
    return data["id"], data["webSocketDebuggerUrl"]


def close_tab(tab_id):
    try:
        urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/close/{tab_id}", timeout=5)
    except Exception:
        pass


class CDP:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=30)
        self._id = 0
        self.responses = {}  # requestId -> {url, mimeType, encodedDataLength, resourceType}

    def send(self, method, params=None):
        self._id += 1
        mid = self._id
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
        return mid

    def recv_until(self, target_id=None, timeout=30):
        deadline = time.time() + timeout
        self.ws.settimeout(1.0)
        while time.time() < deadline:
            try:
                raw = self.ws.recv()
            except Exception:
                continue
            msg = json.loads(raw)
            self._handle_event(msg)
            if target_id is not None and msg.get("id") == target_id:
                return msg
        return None

    def _handle_event(self, msg):
        method = msg.get("method")
        if method == "Network.responseReceived":
            p = msg["params"]
            rid = p["requestId"]
            resp = p["response"]
            self.responses.setdefault(rid, {})
            self.responses[rid].update({
                "url": resp.get("url"),
                "mimeType": resp.get("mimeType"),
                "resourceType": p.get("type"),
            })
        elif method == "Network.loadingFinished":
            p = msg["params"]
            rid = p["requestId"]
            self.responses.setdefault(rid, {})
            self.responses[rid]["encodedDataLength"] = p.get("encodedDataLength", 0)

    def call(self, method, params=None, timeout=30):
        mid = self.send(method, params)
        return self.recv_until(mid, timeout=timeout)

    def drain(self, seconds):
        deadline = time.time() + seconds
        self.ws.settimeout(0.5)
        while time.time() < deadline:
            try:
                raw = self.ws.recv()
            except Exception:
                continue
            self._handle_event(json.loads(raw))


DISMISS_CONSENT_JS = """
(() => {
  const words = ['accept all', 'accept', 'okay', 'ok', 'agree', 'i agree', 'got it', 'allow all'];
  const clickable = Array.from(document.querySelectorAll('button, a, [role="button"]'));
  for (const el of clickable) {
    const t = (el.textContent || '').trim().toLowerCase();
    if (words.includes(t)) { el.click(); return t; }
  }
  return null;
})()
"""

DETECT_JS = """
(() => {
  const canvases = Array.from(document.querySelectorAll('canvas'));
  let webglCount = 0;
  let engineHints = new Set();
  for (const c of canvases) {
    try {
      if (c.getContext('webgl2') || c.getContext('webgl')) webglCount++;
    } catch (e) {}
  }
  if (window.THREE) engineHints.add('three.js (window.THREE)');
  if (window.BABYLON) engineHints.add('babylon.js (window.BABYLON)');
  if (window.pixiJS || window.PIXI) engineHints.add('pixi.js');
  const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
  for (const s of scripts) {
    const low = s.toLowerCase();
    if (low.includes('three')) engineHints.add('script:three-named-bundle');
    if (low.includes('babylon')) engineHints.add('script:babylon-named-bundle');
    if (low.includes('unity')) engineHints.add('script:unity-named-bundle');
    if (low.includes('webgl')) engineHints.add('script:webgl-named-bundle');
  }
  return JSON.stringify({
    canvasCount: canvases.length,
    webglContextCount: webglCount,
    engineHints: Array.from(engineHints),
    scriptCount: scripts.length,
    title: document.title,
    bodyImgCount: document.querySelectorAll('img').length,
  });
})()
"""


def measure(url, out_prefix):
    proc = start_chrome()
    try:
        tab_id, ws_url = new_tab()
        cdp = CDP(ws_url)
        cdp.call("Page.enable")
        cdp.call("Network.enable")
        cdp.call("Runtime.enable")
        nav = cdp.call("Page.navigate", {"url": url}, timeout=20)
        # Let the page settle: JS-mounted WebGL scenes and lazy assets need real time.
        cdp.drain(8)
        # Best-effort generic cookie-consent dismissal -- several sites gate 3D
        # mounting behind it. Not a full per-site interaction flow (that's the
        # separate, larger, still-unstarted "interaction gap" item in
        # 11_EXECUTION_STATE.md's Work queue) -- just enough to see past a
        # modal blocking the initial passive-load measurement.
        cdp.call("Runtime.evaluate", {"expression": DISMISS_CONSENT_JS}, timeout=10)
        cdp.drain(20)
        eval_result = cdp.call("Runtime.evaluate", {"expression": DETECT_JS, "returnByValue": True}, timeout=10)
        detected = {}
        try:
            detected = json.loads(eval_result["result"]["result"]["value"])
        except Exception as e:
            detected = {"error": str(e), "raw": eval_result}

        shot = cdp.call("Page.captureScreenshot", {"format": "png"}, timeout=15)
        if shot and "result" in shot:
            import base64
            png_path = f"{out_prefix}.png"
            with open(png_path, "wb") as f:
                f.write(base64.b64decode(shot["result"]["data"]))
        else:
            png_path = None

        by_type = {}
        total_bytes = 0
        asset_count = 0
        for r in cdp.responses.values():
            size = r.get("encodedDataLength", 0) or 0
            rtype = r.get("resourceType", "Other")
            by_type[rtype] = by_type.get(rtype, 0) + size
            total_bytes += size
            asset_count += 1

        close_tab(tab_id)
        return {
            "url": url,
            "detected": detected,
            "network_by_type_bytes": by_type,
            "total_bytes": total_bytes,
            "asset_count": asset_count,
            "screenshot": png_path,
        }
    finally:
        stop_chrome(proc)


SITES = {
    "3d_suit_designer": "https://www.3dsuitdesigner.com/customize",
    "enzo_custom": "https://enzocustom.com/customize/suit-2p",
    "sartoro": "https://sartoro.co/products/astor-suit-in-sand-linen",
    "bold_italia": "https://bolditaliasuit.com/products/design-3-piece-suit-men",
    "suitablee": "https://suitablee.com/en/suit",
    "lanieri": "https://lanieri.com/en/pages/configurator",
}

if __name__ == "__main__":
    which = sys.argv[1:] or list(SITES.keys())
    results = {}
    for name in which:
        url = SITES[name]
        print(f"[pass-b] measuring {name}: {url}", file=sys.stderr)
        try:
            results[name] = measure(url, f"/tmp/pass-b-{name}")
        except Exception as e:
            results[name] = {"url": url, "error": str(e)}
        print(json.dumps(results[name], indent=2))
    with open("/tmp/pass-b-results.json", "w") as f:
        json.dump(results, f, indent=2)
