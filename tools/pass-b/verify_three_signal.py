"""
Confirm/refute the earlier "three" hit in Suitablee's requirejs-config.min.js
-- that hit was just the string "three" appearing in a bundled config file,
which could be a RequireJS module alias (real signal) or a false positive
(e.g. a path fragment, a comment, an unrelated word). Query the live
RequireJS module registry directly for a stronger signal: if a module
literally named "three" is registered/loaded, that's a real dependency,
not a substring match.
"""
import json
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
from measure import start_chrome, stop_chrome, new_tab, close_tab, CDP, DISMISS_CONSENT_JS

CHECK_JS = """
(() => {
  const result = {requireDefined: typeof require !== 'undefined'};
  try {
    if (typeof require !== 'undefined' && require.s && require.s.contexts) {
      const ctx = require.s.contexts._;
      const paths = (ctx.config && ctx.config.paths) || {};
      const pathKeys = Object.keys(paths).filter(k => k.toLowerCase().includes('three'));
      const defined = ctx.defined ? Object.keys(ctx.defined).filter(k => k.toLowerCase().includes('three')) : [];
      const registry = ctx.registry ? Object.keys(ctx.registry).filter(k => k.toLowerCase().includes('three')) : [];
      result.pathKeys = pathKeys;
      result.pathValues = pathKeys.map(k => paths[k]);
      result.definedModules = defined;
      result.registryModules = registry;
    }
  } catch (e) { result.error = String(e); }
  result.windowTHREE = typeof window.THREE !== 'undefined';
  return JSON.stringify(result);
})()
"""

proc = start_chrome()
try:
    tab_id, ws_url = new_tab()
    cdp = CDP(ws_url)
    cdp.call("Page.enable")
    cdp.call("Network.enable")
    cdp.call("Runtime.enable")
    cdp.call("Page.navigate", {"url": "https://suitablee.com/en/suit"}, timeout=20)
    cdp.drain(8)
    cdp.call("Runtime.evaluate", {"expression": DISMISS_CONSENT_JS}, timeout=10)
    cdp.drain(20)
    r = cdp.call("Runtime.evaluate", {"expression": CHECK_JS, "returnByValue": True}, timeout=10)
    out = json.loads(r["result"]["result"]["value"])
    print(json.dumps(out, indent=2))
    close_tab(tab_id)
finally:
    stop_chrome(proc)
