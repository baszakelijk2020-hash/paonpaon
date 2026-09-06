"use client";

import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { showStoreEnvironment } from "../environment-store";
import { showStorefrontCategory } from "../storefront-host";

interface StorefrontCategoryControlProps {
  baseHref: string;
  category: string | null;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

function hrefFor(baseHref: string, category: string | null): string {
  const url = new URL(baseHref, "http://paon.local");
  if (category) url.searchParams.set("category", category);
  else url.searchParams.delete("category");
  return `${url.pathname}${url.search}${url.hash}`;
}

function currentCategory(): string | null {
  if (typeof window === "undefined") return null;
  return new URL(window.location.href).searchParams.get("category");
}

/** A real link for browser semantics with an in-document hot path. */
export function StorefrontCategoryControl({
  baseHref,
  category,
  children,
  className,
  style,
}: StorefrontCategoryControlProps) {
  const href = hrefFor(baseHref, category);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const handledPointer = useRef(false);

  useEffect(() => {
    const sync = () => setActiveCategory(currentCategory());
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("paon:storefront-location", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("paon:storefront-location", sync);
    };
  }, []);

  const activate = (control: HTMLAnchorElement) => {
    for (const item of control
      .closest("aside")
      ?.querySelectorAll<HTMLElement>("[data-storefront-category-control]") ??
      []) {
      const isActive = item === control;
      item.dataset["active"] = String(isActive);
      if (isActive) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    }
    showStoreEnvironment();
    showStorefrontCategory(category);
    if (`${window.location.pathname}${window.location.search}` !== href) {
      window.history.pushState(window.history.state, "", href);
    }
    setActiveCategory(category);
    window.dispatchEvent(new Event("paon:storefront-location"));
  };

  const onPointerDown = (event: PointerEvent<HTMLAnchorElement>) => {
    if (event.button !== 0) return;
    handledPointer.current = true;
    activate(event.currentTarget);
  };

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }
    event.preventDefault();
    if (handledPointer.current) {
      handledPointer.current = false;
      return;
    }
    activate(event.currentTarget);
  };

  return (
    <a
      href={href}
      onPointerDown={onPointerDown}
      onClick={onClick}
      data-storefront-category-control
      data-active={activeCategory === category ? "true" : "false"}
      aria-current={activeCategory === category ? "page" : undefined}
      className={className}
      style={style}
    >
      {children}
    </a>
  );
}
