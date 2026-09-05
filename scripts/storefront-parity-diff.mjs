/**
 * Storefront parity harness.
 *
 * Loads the raw founder storefront (/r/[slug]/raw, served byte-for-byte by
 * raw/route.ts) and the React route (/r/[slug]) side by side, walks
 * both DOMs, and reports every structural, textual and computed-style
 * difference.
 *
 * The left sidebar is excluded by design: the React route deliberately renders
 * the customer environment's <ShopCategorySidebar/> there instead of the
 * template's own <aside>. Everything else is expected to match exactly.
 *
 * Usage: node scripts/storefront-parity-diff.mjs [--port 3117] [--slug atelier-demo]
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const PORT = argValue("port", "3117");
/**
 * --baseline compares the raw page against itself. The home feed randomises
 * its card titles and ordering on every load, so a run against the React
 * route always reports some churn; the baseline measures that inherent noise
 * floor so real regressions can be told apart from it.
 */
const BASELINE = args.includes("--baseline");
/** Optional filters so the matrix can be run in low-memory chunks. */
const ONLY_VIEWPORT = argValue("viewport", "");
const ONLY_ROUTE = argValue("route", "");
const SLUG = argValue("slug", "atelier-demo");
const BASE = `http://localhost:${PORT}`;

/** Properties whose difference is visible to a human. */
const STYLE_PROPS = [
  "display",
  "position",
  "top",
  "left",
  "right",
  "bottom",
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
  "backdropFilter",
  "webkitBackdropFilter",
  "filter",
  "opacity",
  "zIndex",
  "borderRadius",
  "borderWidth",
  "borderColor",
  "boxShadow",
  "transform",
  "transition",
  "animation",
  "overflow",
  "gridTemplateColumns",
  "gridTemplateRows",
  "gap",
  "alignItems",
  "justifyContent",
  "flexDirection",
  "objectFit",
  "visibility",
  "textAlign",
];

/**
 * Builds a signature of every rendered element, keyed by a stable DOM path so
 * the two documents can be aligned. Elements inside the sidebar, and script /
 * style / framework-injected nodes, are skipped.
 */
const SIGNATURE_FN = `(props) => {
  const skipTags = new Set(["SCRIPT", "STYLE", "LINK", "NEXT-ROUTE-ANNOUNCER", "TEMPLATE"]);
  const out = [];

  /**
   * Nodes that exist only to host the template markup in React and paint
   * nothing themselves. They are flattened away so DOM paths line up with the
   * raw page, which has no such wrappers.
   */
  function isWrapper(el) {
    if (el.classList && el.classList.contains("paon-template-root")) return true;
    if (el.classList && el.classList.contains("retailer-theme")) return true;
    if (el.style && el.style.display === "contents") return true;
    // Next.js' unstyled top-level div(s) directly under <body>.
    if (
      el.tagName === "DIV" &&
      el.parentElement === document.body &&
      !el.id &&
      (!el.className || el.className === "")
    ) {
      return true;
    }
    return false;
  }

  function skipEntirely(el) {
    if (skipTags.has(el.tagName)) return true;
    // The React route intentionally replaces the template's <aside>.
    if (el.tagName === "ASIDE") return true;
    if (el.tagName.startsWith("NEXTJS-")) return true;
    // Next.js dev-mode portal/overlay containers.
    if (el.id && el.id.startsWith("__next")) return true;
    return false;
  }

  /** Children with wrappers flattened into their parent's child list. */
  function effectiveChildren(el) {
    const result = [];
    for (const child of el.children) {
      if (skipEntirely(child)) continue;
      if (isWrapper(child)) result.push(...effectiveChildren(child));
      else result.push(child);
    }
    return result;
  }

  function visit(el, parentPath) {
    const kids = effectiveChildren(el);
    const tagCounts = new Map();
    for (const k of kids) {
      tagCounts.set(k.tagName, (tagCounts.get(k.tagName) || 0) + 1);
    }
    const seen = new Map();
    for (const child of kids) {
      const n = seen.get(child.tagName) || 0;
      seen.set(child.tagName, n + 1);
      const multi = tagCounts.get(child.tagName) > 1;
      const step = child.tagName.toLowerCase() + (multi ? "[" + n + "]" : "");
      const path = parentPath ? parentPath + ">" + step : step;

      const cs = getComputedStyle(child);
      const rect = child.getBoundingClientRect();
      const styles = {};
      for (const p of ${JSON.stringify(STYLE_PROPS)}) styles[p] = cs[p];

      let ownText = "";
      for (const n2 of child.childNodes) {
        if (n2.nodeType === 3) ownText += n2.nodeValue;
      }
      ownText = ownText.replace(/\\s+/g, " ").trim();

      out.push({
        path,
        tag: child.tagName,
        id: child.id || "",
        cls: typeof child.className === "string" ? child.className.trim() : "",
        text: ownText.slice(0, 120),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        styles,
      });

      visit(child, path);
    }
  }

  /*
   * Walk the template subtree only. On the React route that is
   * .paon-template-root; the customer app's own chrome (the hidden
   * TableService pill and friends injected by layout.tsx) lives outside it
   * and has no counterpart on the raw page, so including it shifted every
   * subsequent sibling index and produced spurious paired
   * missing-in-react / extra-in-react findings.
   */
  const scanRoot = document.querySelector(".paon-template-root") || document.body;
  visit(scanRoot, "");
  return {
    url: location.pathname + location.search,
    htmlClass: document.documentElement.className,
    bodyClass: document.body.className,
    elements: out,
  };
}`;

async function signature(page, url, viewport, interaction) {
  await page.setViewportSize(viewport);
  await page.goto(url, { waitUntil: "load", timeout: 120000 });
  // Let the template's own scripts build the grid / feed and settle.
  await page.waitForTimeout(3500);
  if (interaction) {
    await page.evaluate(interaction);
    // Let open/close transitions finish (the longest is 500ms).
    await page.waitForTimeout(1200);
  }
  return page.evaluate(`(${SIGNATURE_FN})()`);
}

function diffSignatures(rawSig, reactSig, label) {
  const findings = [];
  const rawByPath = new Map(rawSig.elements.map((e) => [e.path, e]));
  const reactByPath = new Map(reactSig.elements.map((e) => [e.path, e]));

  // Class order carries no meaning to the cascade here (no selector in the
  // template depends on it), and the template's scripts add its state classes
  // in a different order than React's initial render, so compare as sets.
  const classSet = (value) =>
    value.trim().split(/\s+/).filter(Boolean).sort().join(" ");

  if (classSet(rawSig.htmlClass) !== classSet(reactSig.htmlClass)) {
    findings.push({
      kind: "html-class",
      label,
      raw: rawSig.htmlClass,
      react: reactSig.htmlClass,
    });
  }
  if (classSet(rawSig.bodyClass) !== classSet(reactSig.bodyClass)) {
    findings.push({
      kind: "body-class",
      label,
      raw: rawSig.bodyClass,
      react: reactSig.bodyClass,
    });
  }

  for (const [path, rawEl] of rawByPath) {
    const reactEl = reactByPath.get(path);
    if (!reactEl) {
      findings.push({
        kind: "missing-in-react",
        label,
        path,
        tag: rawEl.tag,
        id: rawEl.id,
        cls: rawEl.cls.slice(0, 60),
        text: rawEl.text.slice(0, 60),
      });
      continue;
    }
    if (rawEl.text !== reactEl.text) {
      findings.push({
        kind: "text",
        label,
        path,
        id: rawEl.id,
        cls: rawEl.cls.slice(0, 40),
        raw: rawEl.text,
        react: reactEl.text,
      });
    }
    // An element that paints no box on either page cannot show a visual
    // difference, whatever its computed styles say. This covers display:none
    // as well as collapsed accordion bodies (max-height:0 / opacity:0) and
    // anything inside a hidden ancestor — e.g. #body-archetype computes
    // `block` on the raw page but has offsetParent null and zero height, so
    // its `display` differing from the React route is invisible.
    const bothHidden =
      (rawEl.styles.display === "none" && reactEl.styles.display === "none") ||
      (rawEl.w === 0 && rawEl.h === 0 && reactEl.w === 0 && reactEl.h === 0);

    // Tailwind's preflight sets border-color on every element; with a 0px
    // border that is invisible. Only report it when a border is actually
    // drawn on one of the two pages.
    const noVisibleBorder =
      rawEl.styles.borderWidth === "0px" &&
      reactEl.styles.borderWidth === "0px";

    for (const p of STYLE_PROPS) {
      if (bothHidden) break;
      if (p === "borderColor" && noVisibleBorder) continue;
      if (rawEl.styles[p] !== reactEl.styles[p]) {
        findings.push({
          kind: "style",
          label,
          path,
          id: rawEl.id,
          cls: rawEl.cls.slice(0, 40),
          prop: p,
          raw: rawEl.styles[p],
          react: reactEl.styles[p],
        });
      }
    }
    for (const dim of ["w", "h", "x", "y"]) {
      if (Math.abs(rawEl[dim] - reactEl[dim]) > 1) {
        findings.push({
          kind: "geometry",
          label,
          path,
          id: rawEl.id,
          cls: rawEl.cls.slice(0, 40),
          prop: dim,
          raw: rawEl[dim],
          react: reactEl[dim],
        });
      }
    }
  }

  for (const [path, reactEl] of reactByPath) {
    if (!rawByPath.has(path)) {
      findings.push({
        kind: "extra-in-react",
        label,
        path,
        tag: reactEl.tag,
        id: reactEl.id,
        cls: reactEl.cls.slice(0, 60),
        text: reactEl.text.slice(0, 60),
      });
    }
  }

  return findings;
}

const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];

/**
 * Interactions applied after load, so states that only exist once a panel is
 * open are compared too. Each runs identically on both pages; anything the
 * template does not expose is a no-op and simply yields an unchanged page.
 */
const INTERACTIONS = {
  none: null,
  filterPanel: `() => { if (typeof window.openFilterPanel === "function") window.openFilterPanel(); }`,
  favourites: `() => { if (typeof window.toggleFavorites === "function") window.toggleFavorites(); }`,
  detail: `() => { const c = document.querySelector("#product-grid .grid-card"); if (c) c.click(); }`,
  appointment: `() => { if (typeof window.paonOpenAppointmentSheet === "function") window.paonOpenAppointmentSheet(); }`,
  tableService: `() => { const t = document.getElementById("gilda-chat-widget-toggle"); if (t) t.click(); }`,
};

const ROUTES = [
  { name: "home", query: "" },
  { name: "Suits", query: "?category=Suits" },
  { name: "Jackets", query: "?category=Jackets" },
  { name: "Pants", query: "?category=Pants" },
  { name: "Knits", query: "?category=Knits" },
  { name: "Shoes", query: "?category=Shoes" },
];

const browser = await chromium.launch();
const page = await browser.newPage();

/*
 * Findings are folded into `grouped` as they are produced. Retaining every
 * individual finding across the full matrix (72 page pairs x ~1200 elements
 * x 40 properties) exhausted memory and the run was killed.
 */
const grouped = new Map();
let totalFindings = 0;

function absorb(findings) {
  totalFindings += findings.length;
  for (const f of findings) {
    const key = [f.kind, f.prop ?? "", f.id || f.cls || f.path, f.raw, f.react]
      .map((v) => String(v ?? "").slice(0, 80))
      .join(" | ");
    let entry = grouped.get(key);
    if (!entry) {
      entry = { ...f, count: 0, labels: new Set() };
      grouped.set(key, entry);
    }
    entry.count += 1;
    if (entry.labels.size < 12) entry.labels.add(f.label);
  }
}

const ACTIVE_INTERACTIONS = args.includes("--interactions")
  ? Object.entries(INTERACTIONS)
  : [["none", null]];

for (const vp of VIEWPORTS) {
  if (ONLY_VIEWPORT && vp.name !== ONLY_VIEWPORT) continue;
  for (const route of ROUTES) {
    if (ONLY_ROUTE && route.name !== ONLY_ROUTE) continue;
    for (const [interactionName, interaction] of ACTIVE_INTERACTIONS) {
      // Panels/drawers are global chrome; exercising them on every category
      // multiplies runtime and memory for no extra coverage.
      if (
        interactionName !== "none" &&
        !["home", "Jackets"].includes(route.name)
      ) {
        continue;
      }
      const label = `${vp.name} ${route.name} ${interactionName}`;
      const rawSig = await signature(
        page,
        `${BASE}/r/${SLUG}/raw${route.query}`,
        vp,
      );
      const reactSig = await signature(
        page,
        BASELINE
          ? `${BASE}/r/${SLUG}/raw${route.query}`
          : `${BASE}/r/${SLUG}${route.query}`,
        vp,
        interaction,
      );
      const findings = diffSignatures(rawSig, reactSig, label);
      absorb(findings);
      console.log(
        `${label.padEnd(38)} raw=${String(rawSig.elements.length).padStart(5)} react=${String(reactSig.elements.length).padStart(5)} findings=${findings.length}`,
      );
    }
  }
}

await browser.close();

const report = [...grouped.values()].sort((a, b) => b.count - a.count);
writeFileSync(
  BASELINE ? "/tmp/parity-baseline.json" : "/tmp/parity-report.json",
  JSON.stringify(
    report.map((r) => ({ ...r, labels: [...r.labels] })),
    null,
    2,
  ),
);

console.log(`\nTOTAL findings: ${totalFindings}  (unique: ${report.length})`);
console.log("Top 60 unique findings:\n");
for (const r of report.slice(0, 60)) {
  const where = r.id ? `#${r.id}` : r.cls ? `.${r.cls}` : r.path;
  if (r.kind === "style" || r.kind === "geometry") {
    console.log(
      `[${String(r.count).padStart(3)}x] ${r.kind}/${r.prop} ${where}\n        raw: ${r.raw}\n      react: ${r.react}`,
    );
  } else if (r.kind === "text") {
    console.log(
      `[${String(r.count).padStart(3)}x] text ${where}\n        raw: "${r.raw}"\n      react: "${r.react}"`,
    );
  } else {
    console.log(
      `[${String(r.count).padStart(3)}x] ${r.kind} ${where} <${r.tag ?? ""}> ${r.text ?? ""}`,
    );
  }
}
console.log("\nFull report: /tmp/parity-report.json");
