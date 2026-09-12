"use client";

import gsap from "gsap";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface HubTab {
  id: string;
  href: string;
  panel: React.ReactNode;
}

/** Panels stay mounted so form drafts and wardrobe selections survive a switch. */
export function HubTabs({
  tabs,
  initialTabId,
}: {
  tabs: HubTab[];
  initialTabId: string;
}) {
  const [activeId, setActiveId] = useState(initialTabId);
  const root = useRef<HTMLDivElement>(null);
  const direction = useRef(1);
  const active = useRef(initialTabId);
  const first = useRef(true);
  const scrollPositions = useRef(new Map<string, number>());
  const moveFocus = useRef(false);
  useEffect(() => {
    const activate = (id: string) => {
      direction.current =
        tabs.findIndex((t) => t.id === id) >=
        tabs.findIndex((t) => t.id === active.current)
          ? 1
          : -1;
      const scroller = root.current?.closest(".paon-shell-content");
      scrollPositions.current.set(active.current, scroller?.scrollTop ?? 0);
      active.current = id;
      setActiveId(id);
      window.dispatchEvent(new Event("paon:customer-tab"));
    };
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.search || url.hash)
        return;
      const tab = tabs.find((t) => t.href === url.pathname);
      if (!tab) return;
      event.preventDefault();
      event.stopPropagation();
      if (tab.id === active.current) return;
      moveFocus.current = !link.hasAttribute("data-customer-top-menu");
      window.history.pushState(null, "", tab.href);
      activate(tab.id);
    };
    const onPop = () => {
      const requested =
        window.location.pathname === "/hub"
          ? (new URLSearchParams(window.location.search).get("tab") ??
            "dashboard")
          : tabs.find((t) => t.href === window.location.pathname)?.id;
      if (requested && tabs.some((t) => t.id === requested))
        activate(requested);
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
    };
  }, [tabs]);
  useLayoutEffect(() => {
    const panel = root.current?.querySelector<HTMLElement>(
      `[data-customer-panel="${activeId}"]`,
    );
    if (!panel) return;
    const scroller = root.current?.closest(".paon-shell-content");
    if (!first.current && scroller)
      scroller.scrollTop = scrollPositions.current.get(activeId) ?? 0;
    if (moveFocus.current) {
      panel.focus({ preventScroll: true });
      moveFocus.current = false;
    }
    if (
      first.current ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      first.current = false;
      return;
    }
    const context = gsap.context(() => {
      gsap.fromTo(
        panel,
        { opacity: 0.3, x: direction.current * 24, filter: "blur(10px)" },
        {
          opacity: 1,
          x: 0,
          filter: "blur(0px)",
          duration: 0.55,
          ease: "power4.out",
          clearProps: "transform,filter,opacity",
        },
      );
    }, root);
    return () => context.revert();
  }, [activeId]);
  return (
    <div ref={root} className="pe-panels">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          data-customer-panel={tab.id}
          tabIndex={-1}
          hidden={tab.id !== activeId}
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
