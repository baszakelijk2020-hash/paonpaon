"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Routes the template owns and must keep handling itself. Everything else that
 * points inside this app is handed to the Next router so the shared (shell)
 * layout — and therefore the sidebar — survives the navigation.
 */
const TEMPLATE_OWNED = /^\/r\/[^/]+(?:\/raw)?(?:[?#]|$)/;

function isInternalHref(href: string | null): href is string {
  if (!href) return false;
  // Same-origin absolute paths only; anything else (external host, mailto:,
  // tel:, #anchor, javascript:) stays with the browser / the template.
  return href.startsWith("/") && !href.startsWith("//");
}

/**
 * Live template DOM, kept across navigations away from the storefront.
 *
 * Leaving for the customer environment used to unmount this subtree, and
 * coming back re-injected the markup and re-ran all 38 inline scripts: the
 * grid rebuilt itself, images reloaded, scroll jumped to the top and every
 * open panel closed — the visitor lost their place in a store they had
 * already loaded. The scripts also re-registered their document/window
 * listeners each time, so a second visit ran every handler twice.
 *
 * Instead the built subtree is detached on unmount and re-attached on the way
 * back, exactly as it was. Its listeners are bound to those nodes and survive
 * the move; the template's globals were never torn down. Nothing is
 * re-executed.
 *
 * Keyed per rendering (retailer + category), because the server serialises
 * different markup for each. The cache holds at most a handful of entries for
 * one browsing session and is discarded with the page.
 */
/**
 * The template scrolls its own `<main id="main">` (tens of thousands of pixels
 * of catalogue), not the window — the document itself is exactly one viewport
 * tall. Reading window.scrollY here always returned 0, so a restored view
 * silently snapped back to the top.
 */
function templateScroller(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>("main#main");
}

/**
 * Puts the template where the raw page has it: a direct child of <body>,
 * ahead of React's root.
 *
 * Inside React's container it was covered by React DOM's event delegation,
 * which installs a NON-PASSIVE scroll listener on `document` — the browser
 * then has to run React before it can paint each scroll frame. Measured
 * against the byte-identical raw route, that alone took the home feed from 2
 * dropped frames to 23. The raw page has no such listener because nothing
 * there is React.
 *
 * First child, not appended: the template's last inline script does
 * `document.querySelector('aside')` and rebuilds what it finds, meaning its
 * own. The shared sidebar is an <aside> too, so the template has to come
 * first in the document or it rebuilds the wrong one. The sidebar is
 * position:fixed above it, so document order changes nothing visually.
 */
/** Drop the least recently shown renderings, never the one on screen. */
function evictOldest(keep: string): void {
  while (liveTemplates.size > MAX_LIVE_TEMPLATES) {
    const oldest = [...liveTemplates.keys()].find((key) => key !== keep);
    if (!oldest) return;
    liveTemplates.get(oldest)?.node.remove();
    liveTemplates.delete(oldest);
  }
}

function mountTemplate(root: HTMLElement, cacheKey: string): void {
  if (root.parentElement !== document.body) {
    document.body.insertBefore(root, document.body.firstChild);
  }
  /*
   * Every other rendering steps back first. Each retailer/category combination
   * keeps its own live subtree, and they all live in <body> together — without
   * this, arriving at Jackets left Suits still showing underneath it.
   */
  for (const [key, entry] of liveTemplates) {
    if (key !== cacheKey) park(entry.node);
  }
  unpark(root);
}

/**
 * Set while the template is being parked or brought back, so the scroll the
 * browser fires as a side effect of that is not mistaken for the visitor
 * scrolling.
 */
let suspendScrollTracking = false;

/**
 * Step aside for the customer environment — without moving, resizing or
 * hiding the template.
 *
 * Three earlier attempts each cost the thing they were meant to preserve.
 * `display: none` throws the layout away and with it the scroll position.
 * `visibility: hidden` tells the template's IntersectionObserver that every
 * card left the viewport, so returning replays the whole blur-and-fade reveal.
 * And repositioning it — `position: fixed; inset: 0` — resizes it, which is a
 * full relayout of ~42,000px of catalogue in each direction, the black feed
 * backdrop showing through until the images paint again.
 *
 * So its box is not touched at all. It stays exactly where it is, laid out,
 * painted and intersecting; the customer environment covers it as an opaque
 * overlay (see .paon-shell-content in globals.css). All that changes here is
 * that nothing behind the overlay stays reachable.
 */
function park(root: HTMLElement): void {
  suspendScrollTracking = true;
  root.style.pointerEvents = "none";
  /*
   * `content-visibility: hidden` rather than `visibility` or `display`: it
   * stops the subtree painting while keeping its layout — and, unlike
   * `visibility: hidden`, it does not tell the template's IntersectionObserver
   * that its cards left the viewport, so nothing replays on return.
   */
  root.style.contentVisibility = "hidden";
  root.setAttribute("aria-hidden", "true");
  root.setAttribute("inert", "");
}

function unpark(root: HTMLElement): void {
  suspendScrollTracking = true;
  root.style.removeProperty("pointer-events");
  root.style.removeProperty("content-visibility");
  root.removeAttribute("aria-hidden");
  root.removeAttribute("inert");
}

/** Re-enable scroll tracking once the browser has settled the change. */
function resumeScrollTracking(): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      suspendScrollTracking = false;
    });
  });
}

/*
 * How many renderings to keep alive at once.
 *
 * Each is a full storefront subtree — tens of thousands of pixels of
 * catalogue and its images — so they cannot accumulate for a whole session of
 * browsing categories. Four covers moving between a handful of categories and
 * back, which is the pattern this exists for; the least recently shown is
 * dropped beyond that and simply rebuilds if it is asked for again.
 */
const MAX_LIVE_TEMPLATES = 4;

const liveTemplates = new Map<string, { node: HTMLElement; scrollY: number }>();

interface TemplateMountProps {
  /** The template's <body> markup, scripts and styles stripped. */
  bodyHtml: string;
  /** External script URLs from the template <head>, in document order. */
  externalScripts: readonly string[];
  /** Inline script bodies from the template, in document order. */
  inlineScripts: readonly string[];
  /** URL of the template's stylesheet (./template-styles). */
  stylesheetHref: string;
  /** Identifies this rendering of the template for the live-DOM cache below. */
  cacheKey: string;
}

/**
 * Mounts the founder storefront template inside the React tree.
 *
 * The template is imperative vanilla DOM code: 38 inline <script> blocks that
 * query elements by id, attach listeners and drive GSAP animations. Injecting
 * the real markup and running the real scripts keeps behavior identical to
 * /r/[slug] instead of approximating it in components.
 *
 * Scripts inserted through innerHTML never execute (per HTML spec), so they
 * are stripped server-side and re-inserted here as real <script> elements.
 * `scriptsStarted` guards against React re-running the effect (StrictMode
 * double-invoke, Fast Refresh) and double-registering listeners.
 */
export function TemplateMount({
  bodyHtml,
  externalScripts,
  inlineScripts,
  stylesheetHref,
  cacheKey,
}: TemplateMountProps) {
  const router = useRouter();
  const scriptsStarted = useRef(false);
  const restoredFromCache = useRef(false);
  // The template's `.layout` and `<main>` are never closed in the source, so
  // the DOM the browser builds does not match React's SSR string and
  // hydration fails, making React discard and regenerate the subtree.
  // Rendering the markup only after mount removes the hydration comparison.
  const [templateReady, setTemplateReady] = useState(false);

  /*
   * The template's stylesheet is owned here so its lifetime matches the
   * template's.
   *
   * Rendered as <link precedence="default"> it was hoisted into <head> and
   * deliberately kept there across client navigations — so returning to the
   * customer environment left the template's 63 style blocks applied to it.
   * Its bare `body`/`main` rules then took over: <main> lost its 32px 56px
   * padding, every text node switched to OptimaKlein, and the page collapsed
   * from 2774px to 2174px. A full reload looked fine, which is what made it
   * read as a spacing bug rather than a stylesheet that outlived its page.
   *
   * The markup is also gated on the sheet having loaded, so the template is
   * never painted unstyled on the way in.
   */
  useEffect(() => {
    const selector = `link[data-paon-template-styles="${stylesheetHref}"]`;
    if (document.querySelector<HTMLLinkElement>(selector)) {
      setTemplateReady(true);
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = stylesheetHref;
    link.dataset["paonTemplateStyles"] = stylesheetHref;
    const reveal = () => setTemplateReady(true);
    link.addEventListener("load", reveal);
    // A failed stylesheet must not leave a blank page: show the markup anyway,
    // exactly as the browser would on the raw page.
    link.addEventListener("error", reveal);
    document.head.appendChild(link);

    /*
     * Deliberately never removed or disabled.
     *
     * Disabling it while the visitor is elsewhere looked harmless and was the
     * worst thing here: `main#main` takes its `height: 100vh` and its own
     * scrolling from this sheet, so without it the template relayouts from one
     * viewport to its full ~84,000px, then back on return. That relayout is
     * the flash of black feed backdrop.
     *
     * Its bare `body`/`main`/`aside` rules do reach the customer environment,
     * which is why this used to be torn down; that leak is answered where it
     * lands instead — see .paon-shell-content in globals.css.
     */
  }, [stylesheetHref]);

  /*
   * Attach the template: reuse the live subtree if this rendering has been
   * visited before, otherwise build it once from the server markup.
   */
  useEffect(() => {
    if (!templateReady) return;

    const cached = liveTemplates.get(cacheKey);
    if (cached) {
      restoredFromCache.current = true;
      // Re-inserting makes this the most recently used entry.
      liveTemplates.delete(cacheKey);
      liveTemplates.set(cacheKey, cached);
      mountTemplate(cached.node, cacheKey);
      // Put the visitor back where they were, once the browser has laid the
      // restored subtree out again.
      /*
       * Reassert until it holds. Unparking relays the subtree out, and for a
       * frame or two `main#main` is short enough that the browser clamps the
       * offset back to the top.
       */
      const target = cached.scrollY;
      let frames = 0;
      const restore = () => {
        const scroller = templateScroller(cached.node);
        if (scroller) scroller.scrollTop = target;
        else window.scrollTo(0, target);
        const here = scroller ? scroller.scrollTop : window.scrollY;
        if ((Math.abs(here - target) < 2 && frames > 2) || frames++ > 20) {
          resumeScrollTracking();
          return;
        }
        requestAnimationFrame(restore);
      };
      requestAnimationFrame(restore);
    } else {
      const root = document.createElement("div");
      root.className = "paon-template-root";
      root.innerHTML = bodyHtml;
      mountTemplate(root, cacheKey);
      liveTemplates.set(cacheKey, { node: root, scrollY: 0 });
      evictOldest(cacheKey);
      // mountTemplate unparks, which suspends tracking; the cached branch
      // resumes after restoring, and the first mount has to do the same or no
      // scroll is ever recorded.
      resumeScrollTracking();
    }

    /*
     * Track the offset as it changes rather than reading it on the way out:
     * by the time this effect is cleaned up the router has already moved on,
     * and the reading came back 0 every time.
     */
    const entry = liveTemplates.get(cacheKey);
    const scroller = entry ? templateScroller(entry.node) : null;
    let ticking = false;
    const onScroll = () => {
      // Parking and unparking move the scroller themselves, and the browser
      // fires scroll for it. Those are not the visitor moving, and recording
      // them overwrote the remembered offset with 0.
      if (suspendScrollTracking) return;
      if (ticking || !entry || !scroller) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        entry.scrollY = scroller.scrollTop;
      });
    };
    scroller?.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      scroller?.removeEventListener("scroll", onScroll);
      // Park rather than detach: the node stays in the document, laid out and
      // scrolled where it was, so coming back costs a repaint and no layout.
      /*
       * Park only this rendering. Whether the storefront as a whole is still
       * on screen is EnvironmentTransition's to decide, from the path — this
       * cleanup runs after the next rendering has already mounted, so saying
       * anything about it here contradicts what just happened.
       */
      const parked = liveTemplates.get(cacheKey)?.node;
      if (parked) park(parked);
      resumeScrollTracking();
    };
  }, [templateReady, cacheKey, bodyHtml]);

  useEffect(() => {
    if (!templateReady) return;
    // A restored subtree has already run these; running them again would
    // rebuild the grid and double-register every listener.
    if (restoredFromCache.current) return;
    if (scriptsStarted.current) return;
    scriptsStarted.current = true;

    function loadExternal(src: string) {
      return new Promise<void>((resolve) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
          resolve();
          return;
        }
        const el = document.createElement("script");
        el.src = src;
        el.async = false;
        // Resolve on error too: a blocked CDN must not stop the inline
        // scripts, exactly as a failed CDN load would not on the raw page.
        el.onload = () => resolve();
        el.onerror = () => resolve();
        document.head.appendChild(el);
      });
    }

    void (async () => {
      for (const src of externalScripts) {
        await loadExternal(src);
      }
      for (const code of inlineScripts) {
        const el = document.createElement("script");
        el.textContent = code;
        document.body.appendChild(el);
      }

      // On the raw page these scripts are parsed before DOMContentLoaded, so
      // their `document.addEventListener('DOMContentLoaded', init)` handlers
      // run normally. Injected here they register after the real event has
      // already fired, so their init would never run. Re-fire the same
      // lifecycle events, in the order the browser would.
      document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true }));
      window.dispatchEvent(new Event("load"));
      // Several layout scripts compute column counts on resize and only
      // settle once one fires; the template's own mobile-detect block does
      // the same (`window.dispatchEvent(new Event('resize'))`).
      window.dispatchEvent(new Event("resize"));

      /*
       * Replay `load` for images that finished before the scripts existed.
       *
       * On the raw page the parser reaches the inline <script> blocks before
       * the images finish downloading, so every `img.onload` handler the feed
       * installs actually fires. Here the markup — images included — is
       * inserted in one innerHTML assignment and the scripts run afterwards,
       * so any image already in cache completes with no handler attached. The
       * home feed's blur-fade reveal is driven by those handlers, which left
       * cards stuck at opacity:0 / filter:blur(14px) and their object-fit
       * unset. Two passes: one immediately, one after a beat for images that
       * completed while the scripts were being injected.
       */
      const replayImageLoads = () => {
        for (const img of document.querySelectorAll("img")) {
          if (img.complete && img.naturalWidth > 0) {
            img.dispatchEvent(new Event("load"));
          }
        }
      };
      replayImageLoads();
      window.setTimeout(replayImageLoads, 600);
    })();
  }, [templateReady, externalScripts, inlineScripts]);

  /*
   * Keep in-app navigation on the client router.
   *
   * The template predates the React route and leaves the page the only way
   * plain HTML can: `<a href="/dashboard?returnTo=...">` for "My PAON" and
   * `window.location.href = ...` inside `paonOpenCustomerPortal()`. Both are
   * full document loads, which tear down the (shell) layout and remount the
   * sidebar — the exact reload this route exists to remove.
   *
   * Rather than edit the founder's file, the two exits are intercepted here:
   * a capture-phase delegated click handler for the anchors, and a wrapper
   * around the global for the scripted jump. Links the template owns
   * (/r/<slug>, including its own category links) are left alone so its
   * in-page view switching keeps working untouched.
   */
  useEffect(() => {
    if (!templateReady) return;

    function onClick(event: MouseEvent) {
      // Let the browser keep its modifier-click behaviours (new tab, download,
      // save) and ignore anything but a plain left click.
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
      if (!isInternalHref(href) || TEMPLATE_OWNED.test(href)) return;

      event.preventDefault();
      router.push(href);
    }

    document.addEventListener("click", onClick, true);

    // Warm the customer environment before the click. The template's own
    // "My PAON" anchor is plain markup, so it gets none of the prefetching a
    // <Link> would do, and this is the one navigation every storefront
    // visitor is expected to make.
    router.prefetch("/dashboard");

    return () => document.removeEventListener("click", onClick, true);
  }, [templateReady, router]);

  useEffect(() => {
    if (!templateReady) return;

    const w = window as typeof window & {
      paonOpenCustomerPortal?: () => void;
      __paonPortalPatched?: boolean;
    };

    // The template defines this global inside one of its inline scripts, which
    // are appended asynchronously above — poll briefly rather than assume it
    // already exists.
    const timer = window.setInterval(() => {
      if (
        w.__paonPortalPatched ||
        typeof w.paonOpenCustomerPortal !== "function"
      ) {
        return;
      }
      w.__paonPortalPatched = true;
      window.clearInterval(timer);
      w.paonOpenCustomerPortal = () => {
        router.push(`/dashboard?from=${encodeURIComponent(location.pathname)}`);
      };
    }, 100);

    return () => window.clearInterval(timer);
  }, [templateReady, router]);

  /*
   * React renders nothing. The template is attached to <body> imperatively so
   * it survives this component being unmounted, and so it stays outside
   * React's event delegation — see mountTemplate.
   */
  return null;
}
