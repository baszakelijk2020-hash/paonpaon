"use client";

import { useEffect, useState } from "react";

import {
  DEFAULT_WORK_ADDRESS,
  WORK_ADDRESS_STORAGE_KEY,
} from "../morning-routine/local-widgets";

/**
 * Where the overview's commute tile drives to. Lives here on the profile,
 * not on the tile itself — the tile only reads. Stored per browser; the
 * preset address is what a fresh visitor sees.
 */
export function CommuteSettings() {
  const [address, setAddress] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saved">("idle");

  useEffect(() => {
    try {
      const stored =
        localStorage.getItem(WORK_ADDRESS_STORAGE_KEY) ?? DEFAULT_WORK_ADDRESS;
      setAddress(stored);
      setSaved(stored);
    } catch {
      setAddress(DEFAULT_WORK_ADDRESS);
      setSaved(DEFAULT_WORK_ADDRESS);
    }
  }, []);

  function save(next: string) {
    const trimmed = next.trim();
    if (!trimmed) return;
    try {
      localStorage.setItem(WORK_ADDRESS_STORAGE_KEY, trimmed);
    } catch {
      // Per-browser convenience only.
    }
    setSaved(trimmed);
    setStatus("saved");
    window.setTimeout(() => setStatus("idle"), 2_000);
  }

  function reset() {
    try {
      localStorage.removeItem(WORK_ADDRESS_STORAGE_KEY);
    } catch {
      // Per-browser convenience only.
    }
    setAddress(DEFAULT_WORK_ADDRESS);
    setSaved(DEFAULT_WORK_ADDRESS);
    setStatus("saved");
    window.setTimeout(() => setStatus("idle"), 2_000);
  }

  return (
    <section
      className="pe-card pe-card-coral rounded-[32px] bg-[#f0b6a4] p-7 text-[#181818]"
      data-pe-card
      aria-labelledby="commute-settings-title"
    >
      <p className="customer-kicker text-[#181818]/60">Commute</p>
      <h2
        id="commute-settings-title"
        className="mt-3 text-2xl font-semibold tracking-[-0.03em]"
      >
        Work address
      </h2>
      <p className="mt-2 max-w-xl text-sm text-[#181818]/70">
        The overview shows the drive time from home to here.
      </p>
      <form
        className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          save(address);
        }}
      >
        <input
          aria-label="Work address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Street, postcode, city"
          className="min-h-[48px] min-w-0 flex-1 rounded-full border border-[#181818]/25 bg-white/70 px-5 text-[15px] text-[#181818] outline-none focus:border-[#181818]"
        />
        <button
          type="submit"
          className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#181818] px-5 text-sm font-semibold text-white"
        >
          Save
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-[#181818]/30 px-5 text-sm font-semibold text-[#181818]"
        >
          Reset
        </button>
      </form>
      <p className="mt-3 text-sm text-[#181818]/60" aria-live="polite">
        {status === "saved" ? "Saved." : saved ? `Current: ${saved}` : ""}
      </p>
    </section>
  );
}
