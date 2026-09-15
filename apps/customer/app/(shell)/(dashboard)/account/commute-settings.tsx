"use client";

import { useEffect, useState } from "react";

import {
  DEFAULT_WORK_ADDRESS,
  HOME_ADDRESS_STORAGE_KEY,
  WORK_ADDRESS_STORAGE_KEY,
} from "../morning-routine/local-widgets";

/**
 * The two ends of the commute: home and work. Set here on the profile, not
 * on the overview's tile — the tile only reads them. With location access
 * granted, the tile works out which of the two the customer is at and shows
 * the live drive to the other one.
 *
 * Stored per browser. Work is preset so a fresh visitor sees a reading;
 * home without an address of its own is the overview's home base, Breda.
 */
export function CommuteSettings() {
  const [home, setHome] = useState("");
  const [work, setWork] = useState("");
  const [status, setStatus] = useState<"idle" | "saved">("idle");

  useEffect(() => {
    try {
      setHome(localStorage.getItem(HOME_ADDRESS_STORAGE_KEY) ?? "");
      setWork(
        localStorage.getItem(WORK_ADDRESS_STORAGE_KEY) ?? DEFAULT_WORK_ADDRESS,
      );
    } catch {
      setWork(DEFAULT_WORK_ADDRESS);
    }
  }, []);

  function save() {
    try {
      const nextHome = home.trim();
      const nextWork = work.trim();
      if (nextHome) localStorage.setItem(HOME_ADDRESS_STORAGE_KEY, nextHome);
      else localStorage.removeItem(HOME_ADDRESS_STORAGE_KEY);
      if (nextWork) localStorage.setItem(WORK_ADDRESS_STORAGE_KEY, nextWork);
      else localStorage.removeItem(WORK_ADDRESS_STORAGE_KEY);
    } catch {
      // Per-browser convenience only.
    }
    setStatus("saved");
    window.setTimeout(() => setStatus("idle"), 2_000);
  }

  const field =
    "min-h-[48px] w-full min-w-0 rounded-full border border-[#181818]/25 bg-white/70 px-5 text-[15px] text-[#181818] outline-none focus:border-[#181818]";

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
        Home and work
      </h2>
      <p className="mt-2 max-w-xl text-sm text-[#181818]/70">
        The overview shows the live drive time from wherever you are to the
        other one — to work when you are home, home when you are at work.
      </p>
      <form
        className="mt-5 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <label className="grid gap-1.5 text-sm font-semibold">
          Home address
          <input
            value={home}
            onChange={(event) => setHome(event.target.value)}
            placeholder="Street, postcode, city"
            autoComplete="street-address"
            className={field}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          Work address
          <input
            value={work}
            onChange={(event) => setWork(event.target.value)}
            placeholder="Street, postcode, city"
            className={field}
          />
        </label>
        <div>
          <button
            type="submit"
            className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#181818] px-6 text-sm font-semibold text-white"
          >
            Save
          </button>
        </div>
      </form>
      <p className="mt-3 text-sm text-[#181818]/60" aria-live="polite">
        {status === "saved" ? "Saved." : ""}
      </p>
    </section>
  );
}
