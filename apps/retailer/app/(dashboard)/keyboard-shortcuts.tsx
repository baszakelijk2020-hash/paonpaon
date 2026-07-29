"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * A discoverable "?" shortcut sheet — power-floor-staff affordance, not
 * a replacement for the visible nav. `newClientHref` is optional
 * because workshop roles have no client book to jump to.
 */
export function KeyboardShortcuts({
  newClientHref,
}: {
  newClientHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "?" && !isTypingTarget(event.target)) {
        event.preventDefault();
        setOpen((previous) => !previous);
        return;
      }
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (
        isTypingTarget(event.target) ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      if (event.key === "/") {
        const search = document.querySelector<HTMLInputElement>(
          'input[type="search"]',
        );
        if (search) {
          event.preventDefault();
          search.focus();
        }
        return;
      }
      if (newClientHref && event.key.toLowerCase() === "n") {
        event.preventDefault();
        router.push(newClientHref);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [newClientHref, router]);

  if (!open) return null;

  const shortcuts = [
    { keys: "?", description: "Show this shortcut sheet" },
    ...(newClientHref ? [{ keys: "N", description: "New client" }] : []),
    { keys: "/", description: "Focus search on this page" },
    { keys: "⌘/Ctrl + Enter", description: "Send while composing a message" },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close keyboard shortcuts"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative w-full max-w-sm rounded-[var(--radius-md)] bg-white p-6 shadow-[var(--shadow-elevated)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg text-[var(--color-stone-900)]">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="text-sm text-[var(--color-stone-500)] hover:text-[var(--color-stone-900)]"
          >
            Close
          </button>
        </div>
        <dl className="flex flex-col gap-3">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.keys}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <dt className="text-[var(--color-stone-600)]">
                {shortcut.description}
              </dt>
              <dd className="rounded border border-[var(--color-stone-300)] bg-[var(--color-stone-50)] px-2 py-0.5 font-mono text-xs">
                {shortcut.keys}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
