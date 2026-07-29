"use client";

import type { KeyboardEvent } from "react";

/** The placeholder has promised ⌘/Ctrl+Enter since this composer shipped — this actually wires it, submitting the enclosing form. */
export function MessageTextarea() {
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <textarea
      name="body"
      required
      maxLength={5000}
      aria-label="Message"
      onKeyDown={handleKeyDown}
      className="min-h-16 flex-1 resize-none rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-stone-900)] focus-visible:ring-offset-2"
      placeholder="Write a reply — ⌘/Ctrl+Enter to send"
    />
  );
}
