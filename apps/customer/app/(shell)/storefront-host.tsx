"use client";

import { usePathname } from "next/navigation";
import { memo, useEffect } from "react";

import {
  getEnvironmentSnapshot,
  showCustomerEnvironment,
} from "./environment-store";

interface Payload {
  bodyHtml: string;
  externalScripts: readonly string[];
  inlineScripts: readonly string[];
}

const STORE_PREFIX = "/r/";
/** Where the store is, when we are not standing in it. */
const DEFAULT_SLUG = "atelier-demo";

/** Routes the template owns and must keep handling itself. */
const TEMPLATE_OWNED = /^\/r\/[^/]+(?:\/raw)?(?:[?#]|$)/;

/**
 * The retailer whose storefront is already built, for this document.
 *
 * Module scope, and deliberately never cleared by an unmount: building is a
 * one-time, unabortable act. It used to be guarded by an effect-local
 * `cancelled` flag, and any teardown of the first attempt — StrictMode's
 * double mount, or arriving in the shell through a client-side navigation
 * (signing in at /login and being sent here) — cancelled the build *after* the
 * guard had been claimed. The storefront was then never built, and could never
 * be built again for that slug: pressing Store revealed nothing.
 */
let builtSlug: string | null = null;
let pendingCategoryTimer: number | null = null;

/*
 * Which category the storefront is showing.
 *
 * The storefront route calls this; the host cannot read the query itself.
 * `useSearchParams` in a layout opts every page under it out of static
 * rendering, and `usePathname` does not change when only the query does — so
 * a category click would go unnoticed.
 *
 * `showCollectionGrid` and `showHome` are the template's own entry points, the
 * ones its in-page category list already calls, so this is the same path as
 * clicking inside the storefront.
 */
export function showStorefrontCategory(category: string | null): void {
  const w = window as typeof window & {
    showCollectionGrid?: (categoryName: string) => void;
    showHome?: () => void;
  };

  const show = (): boolean => {
    if (category) {
      if (typeof w.showCollectionGrid === "function") {
        w.showCollectionGrid(category);
        return true;
      }
    } else if (typeof w.showHome === "function") {
      w.showHome();
      return true;
    }
    return false;
  };

  // Once the template is ready this is the entire hot path. Do not put even
  // one timer tick between the pointer event and the template's own view
  // switch.
  if (show()) return;

  // Only the first interaction during template startup needs to wait. Keep a
  // single poll alive so repeated early clicks cannot build a timer backlog.
  if (pendingCategoryTimer !== null) {
    window.clearInterval(pendingCategoryTimer);
  }
  let attempts = 0;
  pendingCategoryTimer = window.setInterval(() => {
    if (show() || attempts++ > 750) {
      if (pendingCategoryTimer !== null) {
        window.clearInterval(pendingCategoryTimer);
        pendingCategoryTimer = null;
      }
    }
  }, 16);
}

function slugFromPath(pathname: string): string | null {
  if (!pathname.startsWith(STORE_PREFIX)) return null;
  return pathname.slice(STORE_PREFIX.length).split("/")[0] || null;
}

/**
 * Resolves once the document has finished parsing.
 *
 * Nothing below may touch <body> — and above all nothing may synthesise a
 * `DOMContentLoaded` — while the App Router's payload is still streaming in.
 * Next.js closes its RSC stream writer on the real `DOMContentLoaded`
 * (next/dist/client/app-index.js), so firing that event early made it close
 * mid-stream: every remaining `self.__next_f.push` chunk in the document then
 * threw "Unexpected server data: missing bootstrap script", the stream ended
 * with "Connection closed.", and the rest of the page — the shared sidebar and
 * the customer environment among it — never arrived. That truncation is what
 * read as the page reloading and taking seconds to settle.
 *
 * Waiting for the real event costs nothing: it fires when the document is
 * parsed, which is exactly when the last of those chunks has run, and the
 * payload fetch below has already been in flight the whole time.
 */
function documentParsed(): Promise<void> {
  if (document.readyState !== "loading") return Promise.resolve();
  return new Promise((resolve) => {
    document.addEventListener("DOMContentLoaded", () => resolve(), {
      once: true,
    });
  });
}

/** Builds the storefront at most once per document. */
function buildStorefrontOnce(slug: string): void {
  if (builtSlug !== null) return;
  builtSlug = slug;
  void buildStorefront(slug);
}

async function buildStorefront(slug: string): Promise<void> {
  /*
   * Build in the state the visitor asked for. Arriving straight at a category
   * URL should look exactly like the server rendering of it, not the home feed
   * built first and then switched — that leaves both views in the document.
   * Later category changes are client-side, through the template's own
   * navigation.
   */
  const initialCategory = new URLSearchParams(window.location.search).get(
    "category",
  );
  const payloadUrl = initialCategory
    ? `/r/${slug}/template-payload?category=${encodeURIComponent(initialCategory)}`
    : `/r/${slug}/template-payload`;

  const [payloadRes] = await Promise.all([
    fetch(payloadUrl, { credentials: "same-origin" }),
    ensureStylesheet(`/r/${slug}/template-styles`),
  ]);
  if (!payloadRes.ok) {
    // Release the claim so a later mount can try again rather than leaving the
    // session with no store at all.
    builtSlug = null;
    return;
  }
  const payload = (await payloadRes.json()) as Payload;

  await documentParsed();

  const root = document.createElement("div");
  root.className = "paon-template-root";
  root.dataset["paonStorefrontRoot"] = "";
  const customerOpen = getEnvironmentSnapshot() === "customer";
  root.inert = customerOpen;
  root.setAttribute("aria-hidden", String(customerOpen));
  root.innerHTML = payload.bodyHtml;
  // First child, not appended: the template's last inline script does
  // `document.querySelector('aside')` and rebuilds what it finds, meaning its
  // own. The shared sidebar is an <aside> too, so the template has to come
  // first in the document.
  document.body.insertBefore(root, document.body.firstChild);

  for (const src of payload.externalScripts) {
    await loadExternalScript(src);
  }
  for (const code of payload.inlineScripts) {
    const el = document.createElement("script");
    el.textContent = code;
    document.body.appendChild(el);
  }

  // On the raw page these scripts are parsed before DOMContentLoaded, so their
  // own `DOMContentLoaded` handlers run. Injected here they register after the
  // real event, so the same lifecycle is re-fired for them. Safe only because
  // documentParsed() above guarantees the App Router's stream is already
  // closed — see the note there.
  document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true }));
  window.dispatchEvent(new Event("load"));
  window.dispatchEvent(new Event("resize"));

  /*
   * Replay `load` for images that finished before the scripts existed. The
   * feed's blur-fade reveal is driven by those handlers, and an image already
   * in cache completes with none attached.
   */
  const replay = () => {
    for (const img of document.querySelectorAll("img")) {
      if (img.complete && img.naturalWidth > 0) {
        img.dispatchEvent(new Event("load"));
      }
    }
  };
  replay();
  window.setTimeout(replay, 600);
}

/**
 * Owns the storefront for the whole session.
 *
 * This is mounted by the (shell) layout, which wraps both environments and is
 * never unmounted, so the storefront is built exactly once and then simply
 * stays. It is not a page: making it one is what kept it being torn down and
 * rebuilt every time the visitor stepped into the customer environment, no
 * matter how much of it was cached on the way out.
 *
 * The customer environment is an overlay that slides over it and away again.
 * Nothing here reacts to that. The only thing the route still says is which
 * category to show, and that is handed to the template's own navigation.
 */
export const StorefrontHost = memo(function StorefrontHost() {
  const pathname = usePathname();

  const slug = slugFromPath(pathname) ?? DEFAULT_SLUG;

  /*
   * Build once, for the first retailer asked for.
   *
   * It starts as soon as the shell mounts — before the visitor asks for the
   * store — so that pressing Store is only ever the overlay sliding away.
   */
  useEffect(() => {
    buildStorefrontOnce(slug);
  }, [slug]);

  /*
   * Keep the template's own exits on the client router.
   *
   * The template predates all of this and leaves the page the only way plain
   * HTML can: `<a href="/dashboard?returnTo=...">` for "My PAON", and
   * `window.location.href` inside `paonOpenCustomerPortal()` for the avatar.
   * Both are full document loads, which throw away the storefront this whole
   * arrangement exists to keep — the page comes back rebuilt from nothing.
   *
   * The founder's file is not edited; the two exits are intercepted here.
   * Links the template owns (/r/<slug>, its own category links) are left alone
   * so its in-page navigation keeps working.
   */
  useEffect(() => {
    function onClick(event: MouseEvent) {
      // Leave the browser's modifier-click behaviours alone.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      // Same-origin paths only; anything else stays with the browser.
      if (!href || !href.startsWith("/") || href.startsWith("//")) return;
      if (TEMPLATE_OWNED.test(href)) return;

      const url = new URL(href, window.location.origin);
      if (url.pathname !== "/dashboard") return;

      event.preventDefault();
      showCustomerEnvironment();
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const url = new URL(window.location.href);
      if (!url.pathname.startsWith(STORE_PREFIX)) return;
      showStorefrontCategory(url.searchParams.get("category"));
      window.dispatchEvent(new Event("paon:storefront-location"));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const w = window as typeof window & {
      paonOpenCustomerPortal?: () => void;
      __paonPortalPatched?: boolean;
    };

    // Defined inside one of the template's inline scripts, appended
    // asynchronously — poll rather than assume it already exists.
    const timer = window.setInterval(() => {
      if (w.__paonPortalPatched) {
        window.clearInterval(timer);
        return;
      }
      if (typeof w.paonOpenCustomerPortal !== "function") return;
      w.__paonPortalPatched = true;
      window.clearInterval(timer);
      w.paonOpenCustomerPortal = () => {
        showCustomerEnvironment();
      };
    }, 100);

    return () => window.clearInterval(timer);
  }, []);

  // Nothing is rendered into React's tree: the template lives in <body>, above
  // React's root, so it is outside React's event delegation. React DOM
  // installs a non-passive scroll listener on `document`, which made scrolling
  // the feed run React on every frame.
  return null;
});

function ensureStylesheet(href: string): Promise<void> {
  return new Promise((resolve) => {
    const selector = `link[data-paon-template-styles="${href}"]`;
    if (document.querySelector(selector)) {
      resolve();
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset["paonTemplateStyles"] = href;
    link.addEventListener("load", () => resolve());
    // A failed stylesheet must not leave a blank page.
    link.addEventListener("error", () => resolve());
    document.head.appendChild(link);
  });
}

function loadExternalScript(src: string): Promise<void> {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.src = src;
    el.async = false;
    // Resolve on error too: a blocked CDN must not stop the inline scripts,
    // exactly as it would not on the raw page.
    el.addEventListener("load", () => resolve());
    el.addEventListener("error", () => resolve());
    document.head.appendChild(el);
  });
}
