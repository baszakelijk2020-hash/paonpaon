/**
 * Sidebar consistency harness.
 *
 * The shared sidebar is now one component rendered from one layout
 * (app/(shell)/layout.tsx), so it should look identical in the customer
 * environment and on the storefront. It does not, because the storefront also
 * loads the founder template's own 63 style blocks, whose bare element
 * selectors and !important overrides reach outside .paon-template-root and
 * restyle the sidebar.
 *
 * This walks the sidebar subtree on both pages and reports every computed
 * style and geometry difference, so the parity layer can be written against
 * measurements instead of guesses.
 *
 * Usage: node scripts/sidebar-parity-diff.mjs [--port 3117] [--slug atelier-demo]
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const PORT = argValue("port", "3117");
const SLUG = argValue("slug", "atelier-demo");
const EMAIL = argValue("email", "contact+isabelle@nebelspiegel.com");
const PASSWORD = argValue("password", "Demo-PAON-2026!");
const BASE = `http://localhost:${PORT}`;

const STYLE_PROPS = [
  "display",
  "position",
  "width",
  "height",
  "margin",
  "padding",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "textTransform",
  "color",
  "backgroundColor",
  "backgroundImage",
  "opacity",
  "borderRadius",
  "borderWidth",
  "borderColor",
  "boxShadow",
  "transform",
  "overflow",
  "gridTemplateRows",
  "gridTemplateColumns",
  "gap",
  "alignItems",
  "justifyContent",
  "flexDirection",
  "textAlign",
  "visibility",
  "objectFit",
  // The brand wordmark's sweep is background-clip:text + a transparent text
  // fill + a keyframe animation; without these the shimmer can be missing and
  // every measured property still matches.
  "animation",
  "animationName",
  "animationDuration",
  "backgroundClip",
  "webkitBackgroundClip",
  "webkitTextFillColor",
  "backgroundSize",
  "backgroundRepeatX",
];

const SIGNATURE_FN = `() => {
  const root = document.querySelector("[data-paon-shell-sidebar]");
  if (!root) return { missing: true, elements: [] };
  const out = [];
  function visit(el, parentPath) {
    const kids = [...el.children].filter((c) => c.tagName !== "SCRIPT" && c.tagName !== "STYLE");
    const counts = new Map();
    for (const k of kids) counts.set(k.tagName, (counts.get(k.tagName) || 0) + 1);
    const seen = new Map();
    for (const child of kids) {
      const n = seen.get(child.tagName) || 0;
      seen.set(child.tagName, n + 1);
      const step = child.tagName.toLowerCase() + (counts.get(child.tagName) > 1 ? "[" + n + "]" : "");
      const path = parentPath ? parentPath + ">" + step : step;
      const cs = getComputedStyle(child);
      const rect = child.getBoundingClientRect();
      const styles = {};
      for (const p of ${JSON.stringify(STYLE_PROPS)}) styles[p] = cs[p];
      let ownText = "";
      for (const n2 of child.childNodes) if (n2.nodeType === 3) ownText += n2.nodeValue;
      out.push({
        path,
        tag: child.tagName,
        cls: typeof child.className === "string" ? child.className.trim().slice(0, 50) : "",
        pill: child.hasAttribute("data-paon-switcher-pill"),
        text: ownText.replace(/\\s+/g, " ").trim().slice(0, 40),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        styles,
      });
      visit(child, path);
    }
  }
  visit(root, "");
  return { missing: false, elements: out };
}`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

// Sign in: the sidebar's signed-in state is the one that must match.
await page.goto(`${BASE}/login?redirectTo=%2Fdashboard`, { waitUntil: "load" });
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await Promise.all([
  page.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => {}),
  page.click('button[type="submit"]'),
]);

async function capture(url) {
  await page.goto(url, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(4000);
  return page.evaluate(`(${SIGNATURE_FN})()`);
}

const dash = await capture(`${BASE}/dashboard`);
const store = await capture(`${BASE}/r/${SLUG}?category=Jackets`);
await browser.close();

if (dash.missing || store.missing) {
  console.log(
    `sidebar missing — dashboard:${dash.missing ? "MISSING" : "ok"} storefront:${store.missing ? "MISSING" : "ok"}`,
  );
  process.exit(1);
}

const byPath = (sig) => new Map(sig.elements.map((e) => [e.path, e]));
const dashMap = byPath(dash);
const storeMap = byPath(store);
const findings = [];

for (const [path, d] of dashMap) {
  const s = storeMap.get(path);
  if (!s) {
    findings.push({
      kind: "missing-on-storefront",
      path,
      tag: d.tag,
      cls: d.cls,
      text: d.text,
    });
    continue;
  }
  if (d.text !== s.text) {
    findings.push({
      kind: "text",
      path,
      cls: d.cls,
      dash: d.text,
      store: s.text,
    });
  }
  const bothHidden = d.w === 0 && d.h === 0 && s.w === 0 && s.h === 0;
  /*
   * The Store / My PAON control is meant to look different in the two
   * environments — whichever half you are currently in is the lit one. Its
   * active-state paint is therefore not a parity defect; everything else
   * about it, including its box metrics, still is.
   */
  const isSwitcherSegment = /\bpcs-(store|mypaon)\b/.test(d.cls);
  /*
   * The sliding pill marks which half you are in, so it is meant to sit over a
   * different label — and therefore at a different width and offset — in each
   * environment. Comparing it would report the toggle working as a defect.
   */
  if (d.pill) continue;
  const ACTIVE_STATE_PROPS = new Set([
    "color",
    "backgroundColor",
    "borderColor",
    "boxShadow",
    "webkitTextFillColor",
  ]);
  for (const p of STYLE_PROPS) {
    if (bothHidden) break;
    if (isSwitcherSegment && ACTIVE_STATE_PROPS.has(p)) continue;
    if (d.styles[p] !== s.styles[p]) {
      findings.push({
        kind: "style",
        prop: p,
        path,
        cls: d.cls,
        dash: d.styles[p],
        store: s.styles[p],
      });
    }
  }
  for (const dim of ["w", "h", "x", "y"]) {
    if (Math.abs(d[dim] - s[dim]) > 1) {
      findings.push({
        kind: "geometry",
        prop: dim,
        path,
        cls: d.cls,
        dash: d[dim],
        store: s[dim],
      });
    }
  }
}
for (const [path, s] of storeMap) {
  if (!dashMap.has(path)) {
    findings.push({
      kind: "extra-on-storefront",
      path,
      tag: s.tag,
      cls: s.cls,
      text: s.text,
    });
  }
}

writeFileSync("/tmp/sidebar-parity.json", JSON.stringify(findings, null, 2));

console.log(
  `dashboard elements=${dash.elements.length}  storefront elements=${store.elements.length}  findings=${findings.length}\n`,
);

// Group style findings by property so the fix list is short.
const byProp = new Map();
for (const f of findings) {
  const key =
    f.kind === "style" || f.kind === "geometry"
      ? `${f.kind}/${f.prop}`
      : f.kind;
  const entry = byProp.get(key) || { count: 0, samples: [] };
  entry.count += 1;
  if (entry.samples.length < 3) entry.samples.push(f);
  byProp.set(key, entry);
}
for (const [key, entry] of [...byProp.entries()].sort(
  (a, b) => b[1].count - a[1].count,
)) {
  console.log(`[${String(entry.count).padStart(3)}x] ${key}`);
  for (const s of entry.samples) {
    const where = s.cls ? `.${s.cls}` : s.path;
    console.log(
      `        ${where}\n          dashboard: ${s.dash ?? s.text ?? ""}\n          storefront: ${s.store ?? ""}`,
    );
  }
}
console.log("\nFull report: /tmp/sidebar-parity.json");
process.exit(findings.length === 0 ? 0 : 1);
