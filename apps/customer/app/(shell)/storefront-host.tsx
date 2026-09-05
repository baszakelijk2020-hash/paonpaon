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

/** The retailer whose storefront is already built, for this document. */
let builtSlug: string | null = null;

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

  let attempts = 0;
  // The template's scripts are appended asynchronously; wait for them.
  const timer = window.setInterval(() => {
    if (category) {
      if (typeof w.showCollectionGrid === "function") {
        w.showCollectionGrid(category);
        window.clearInterval(timer);
      }
    } else if (typeof w.showHome === "function") {
      w.showHome();
      window.clearInterval(timer);
    }
    if (attempts++ > 200) window.clearInterval(timer);
  }, 60);
}

function slugFromPath(pathname: string): string | null {
  if (!pathname.startsWith(STORE_PREFIX)) return null;
  return pathname.slice(STORE_PREFIX.length).split("/")[0] || null;
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
    // Module scope, not a ref: a ref resets if this component is ever
    // remounted, and rebuilding is the one thing that must never happen.
    if (builtSlug === slug) return;
    builtSlug = slug;

    let cancelled = false;

    const run = async () => {
      /*
       * Build in the state the visitor asked for. Arriving straight at a
       * category URL should look exactly like the server rendering of it, not
       * the home feed built first and then switched — that leaves both views
       * in the document. Later category changes are client-side, through the
       * template's own navigation.
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
      if (!payloadRes.ok || cancelled) return;
      const payload = (await payloadRes.json()) as Payload;
      if (cancelled) return;

      const root = document.createElement("div");
      root.className = "paon-template-root";
      root.dataset["paonStorefrontRoot"] = "";
      const customerOpen = getEnvironmentSnapshot() === "customer";
      root.inert = customerOpen;
      root.setAttribute("aria-hidden", String(customerOpen));
      root.innerHTML = payload.bodyHtml;
      // First child, not appended: the template's last inline script does
      // `document.querySelector('aside')` and rebuilds what it finds, meaning
      // its own. The shared sidebar is an <aside> too, so the template has to
      // come first in the document.
      document.body.insertBefore(root, document.body.firstChild);

      for (const src of payload.externalScripts) {
        await loadExternalScript(src);
        if (cancelled) return;
      }
      for (const code of payload.inlineScripts) {
        const el = document.createElement("script");
        el.textContent = code;
        document.body.appendChild(el);
      }

      // On the raw page these scripts are parsed before DOMContentLoaded, so
      // their own `DOMContentLoaded` handlers run. Injected here they register
      // after the real event, so the same lifecycle is re-fired for them.
      document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true }));
      window.dispatchEvent(new Event("load"));
      window.dispatchEvent(new Event("resize"));

      /*
       * Replay `load` for images that finished before the scripts existed.
       * The feed's blur-fade reveal is driven by those handlers, and an image
       * already in cache completes with none attached.
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
    };

    void run();
    return () => {
      cancelled = true;
    };
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
