"use client";

import { useCallback, useEffect, useState } from "react";

export interface HubTab {
  id: string;
  label: string;
  /** The tab's own route, kept so deep links and the back button still work. */
  href: string;
  panel: React.ReactNode;
}

/**
 * Every tab's content is rendered once, on the server, and mounted together —
 * switching is a class change, not a navigation.
 *
 * The tabs used to be eight separate routes, so each switch paid a server render,
 * a database round trip and an RSC payload (115-150KB, ~1.5s warm). No amount of
 * prefetching makes that instant on a first visit. Rendering the panels together
 * and toggling them is the same mechanism the storefront's clothing categories
 * use, which is the speed this is measured against.
 *
 * The URL is still updated with history.replaceState so the address bar, deep
 * links and browser history keep working — but no navigation is triggered, so no
 * data is refetched.
 */
export function HubTabs({
  tabs,
  initialTabId,
}: {
  tabs: HubTab[];
  initialTabId: string;
}) {
  const [activeId, setActiveId] = useState(initialTabId);

  const select = useCallback((tab: HubTab) => {
    setActiveId(tab.id);
    // replaceState, not a router push: pushing would re-enter the router and
    // undo the whole point of this component.
    window.history.replaceState(null, "", tab.href);
  }, []);

  // Keep the panel in sync if the user navigates with the back/forward buttons.
  useEffect(() => {
    const onPop = () => {
      const match = tabs.find((t) => window.location.pathname === t.href);
      if (match) setActiveId(match.id);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [tabs]);

  return (
    <>
      <nav
        aria-label="Account sections"
        className="flex flex-wrap items-center gap-1 border-b border-[var(--customer-border)]"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`hub-panel-${tab.id}`}
              onClick={() => select(tab)}
              className={`relative px-4 py-3 text-sm transition-colors ${
                active
                  ? "text-[var(--customer-ink)]"
                  : "text-[var(--color-stone-500)] hover:text-[var(--customer-ink)]"
              }`}
            >
              {tab.label}
              {active ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-3 -bottom-px block h-[2px] bg-[var(--customer-ink)]"
                />
              ) : null}
            </button>
          );
        })}
      </nav>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`hub-panel-${tab.id}`}
          role="tabpanel"
          // `hidden` rather than unmounting: unmounting would throw the rendered
          // panel away and make the next visit slow again.
          hidden={tab.id !== activeId}
        >
          {tab.panel}
        </div>
      ))}
    </>
  );
}
