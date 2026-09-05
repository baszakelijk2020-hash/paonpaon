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

interface TemplateMountProps {
  /** The template's <body> markup, scripts and styles stripped. */
  bodyHtml: string;
  /** External script URLs from the template <head>, in document order. */
  externalScripts: readonly string[];
  /** Inline script bodies from the template, in document order. */
  inlineScripts: readonly string[];
  /** URL of the template's stylesheet (./template-styles). */
  stylesheetHref: string;
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
}: TemplateMountProps) {
  const router = useRouter();
  const scriptsStarted = useRef(false);
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
    const existing = document.querySelector<HTMLLinkElement>(
      `link[data-paon-template-styles][href="${stylesheetHref}"]`,
    );
    if (existing) {
      setTemplateReady(true);
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = stylesheetHref;
    link.dataset["paonTemplateStyles"] = "true";
    const reveal = () => setTemplateReady(true);
    link.addEventListener("load", reveal);
    // A failed stylesheet must not leave a blank page: show the markup anyway,
    // exactly as the browser would on the raw page.
    link.addEventListener("error", reveal);
    document.head.appendChild(link);

    return () => {
      link.remove();
      setTemplateReady(false);
    };
  }, [stylesheetHref]);

  useEffect(() => {
    if (!templateReady) return;
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

  return (
    <>
      <div
        className="paon-template-root"
        {...(templateReady
          ? { dangerouslySetInnerHTML: { __html: bodyHtml } }
          : {})}
      />
    </>
  );
}
