"use client";

import { useState } from "react";

export function AttachFileInput() {
  const [fileName, setFileName] = useState<string>();

  return (
    <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-[var(--color-stone-500)] hover:text-[var(--color-stone-900)]">
      <span aria-hidden="true">📎</span>
      <span>{fileName ?? "Attach an image"}</span>
      <input
        type="file"
        name="attachment"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Attach an image"
        className="sr-only"
        onChange={(event) => setFileName(event.target.files?.[0]?.name)}
      />
    </label>
  );
}
