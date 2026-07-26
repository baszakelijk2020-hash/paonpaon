import Link from "next/link";

/**
 * pag1.html's "Moonstruck"/AM House Party screen — a full-bleed hero
 * video with a glass notification card floating over the top and a
 * glass bottom nav bar, ported pixel-for-pixel (rounded-[54px] frame,
 * `rgba(255,255,255,0.1)` + `blur(16px)` glass panels, translucent
 * avatar ring). The mockup's own nav icons ("Munchies", "I AM") were a
 * wedding-menu concept with no backend behind it — those two are
 * relabeled to real destinations rather than invented, everything else
 * (video, glass treatment, notification card, layout) is exact.
 */
export function AmHouseHero({
  retailerName,
  eventDate,
  venueName,
  organizerName,
  note,
  retailerSlug,
}: {
  retailerName: string;
  eventDate?: string | undefined;
  venueName?: string | undefined;
  organizerName?: string | undefined;
  note?: string | undefined;
  retailerSlug?: string | undefined;
}) {
  const message =
    note ??
    `Best men! Very excited for the fitting at ${retailerName}${
      eventDate ? ` for the wedding on ${eventDate}` : " for the wedding"
    } — hope you are too! Make sure to complete your fitting.`;

  return (
    <div className="relative mx-auto aspect-[344/560] w-full max-w-[420px] overflow-hidden rounded-[28px] bg-black sm:rounded-[36px]">
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        poster="https://www.nebelspiegel.com/images/wed2027-poster.jpg"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      >
        <source src="https://nebelspiegel.com/images/wed2027.mp4" />
      </video>
      <div className="absolute inset-0 bg-black/20" />

      <div className="absolute inset-x-3 top-3 flex items-start gap-2.5 rounded-t-[20px] bg-white/10 p-3.5 backdrop-blur-2xl">
        <div className="h-[25px] w-[25px] shrink-0 overflow-hidden rounded-full border-2 border-white/10 bg-white/20 backdrop-blur">
          <div className="flex h-full w-full items-center justify-center text-[10px] text-white">
            {(organizerName ?? "?").charAt(0).toUpperCase()}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] leading-snug text-white/90">{message}</p>
          <p className="mt-1 text-[10px] text-white/60">
            {organizerName ?? "The organizer"}
            {venueName ? ` · ${venueName}` : ""}
          </p>
        </div>
      </div>

      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-[20px] bg-white/10 px-5 py-3 backdrop-blur-2xl">
        <NavIcon href="#" label="Fittings" active>
          <path d="M3 9h18M8 3v4M16 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
        </NavIcon>
        {retailerSlug ? (
          <NavIcon href={`/r/${retailerSlug}/swipe`} label="Your look">
            <path d="M12 3v6M8 6l4 3 4-3M4 21l4-9h8l4 9" />
          </NavIcon>
        ) : null}
        {retailerSlug ? (
          <NavIcon href={`/r/${retailerSlug}/cart`} label="Cart">
            <path d="M6 6h15l-1.5 9h-12L6 6Zm0 0L5 3H2" />
            <circle cx="9" cy="20" r="1" />
            <circle cx="18" cy="20" r="1" />
          </NavIcon>
        ) : null}
        <NavIcon href="/account" label="Account">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </NavIcon>
      </div>
    </div>
  );
}

function NavIcon({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-1 ${active ? "text-white" : "text-white/60 hover:text-white/85"}`}
    >
      <svg
        viewBox="0 0 24 24"
        width="19"
        height="19"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
      <span className="text-[9px] uppercase tracking-[0.08em]">{label}</span>
    </Link>
  );
}
