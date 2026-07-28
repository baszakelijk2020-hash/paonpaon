import Link from "next/link";

/**
 * pag1.html's "Moonstruck"/AM House Party screen (`#video-frame-hero2`,
 * `wed2027.mp4`), ported pixel-for-pixel from the real markup at
 * `downloaded_pages/pag1.html` around id `u569403`/`u569392` — not the
 * visually-similar-but-different "AM App" promo screen further up the
 * same file (`munross2026.mp4`), which was the wrong reference an
 * earlier pass used. Verified against the mockup's literal inline
 * styles: `344×735` frame at `border-radius: 54px`, notification card
 * `rgba(255,255,255,0.1)` + `blur(16px)` (Tailwind `backdrop-blur-lg`,
 * not `-2xl`), avatar ring same `blur(16px)`, video `object-fit: cover`
 * under a flat `rgba(0,0,0,0.2)` scrim. The mockup's bottom nav has 5
 * icons (`amhh`, `cutlery`, `hamburger`, `shopping-bag`, `profile` —
 * hosted SVGs, referenced directly here for true glyph fidelity rather
 * than redrawn as generic stroke icons) labeled AM House/Munchies/Menu/
 * Cart/I AM. `amhh`→home, `shopping-bag`→Cart, and `profile`→Account
 * map 1:1 to real destinations. "Munchies" (`cutlery`) and "Menu"
 * (`hamburger`) are both the same food-ordering concept with no backend
 * behind either — rather than fabricate two features or drop both
 * glyphs, they collapse into one real destination ("Your look"), reusing
 * `cutlery` as its icon since neither original glyph reads as "outfit."
 */
export function AmHouseHero({
  retailerName,
  eventDate,
  venueName,
  organizerName,
  note,
  retailerSlug,
  coverPhotoUrl,
}: {
  retailerName: string;
  eventDate?: string | undefined;
  venueName?: string | undefined;
  organizerName?: string | undefined;
  note?: string | undefined;
  retailerSlug?: string | undefined;
  coverPhotoUrl?: string | undefined;
}) {
  const message =
    note ??
    `Best men! Very excited for the fitting at ${retailerName}${
      eventDate ? ` for the wedding on ${eventDate}` : " for the wedding"
    } — hope you are too! Make sure to complete your fitting.`;
  const poster =
    coverPhotoUrl ?? "https://www.nebelspiegel.com/images/wed2027-poster.jpg";

  return (
    <div className="paon-reveal aspect-344/735 max-w-105 relative mx-auto w-full overflow-hidden rounded-[54px] bg-black">
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        poster={poster}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      >
        <source src="https://nebelspiegel.com/images/wed2027.mp4" />
      </video>
      <div className="absolute inset-0 bg-black/20" />

      <div className="absolute inset-x-3 top-3 flex items-start gap-2.5 rounded-t-xl bg-white/10 p-3.5 backdrop-blur-lg">
        <div className="h-6.25 w-6.25 shrink-0 overflow-hidden rounded-full border-2 border-white/10 bg-white/20 backdrop-blur-lg">
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

      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-xl bg-white/10 px-5 py-3 backdrop-blur-lg">
        <NavIcon
          href="#"
          label="AM House"
          active
          iconSrc="https://www.nebelspiegel.com/images/amhh.svg"
          iconWidth={22}
          iconHeight={10}
        />
        {retailerSlug ? (
          <NavIcon
            href={`/r/${retailerSlug}/swipe`}
            label="Your look"
            iconSrc="https://www.nebelspiegel.com/images/cutlery.svg"
            iconWidth={17}
            iconHeight={17}
          />
        ) : null}
        {retailerSlug ? (
          <NavIcon
            href={`/r/${retailerSlug}/cart`}
            label="Cart"
            iconSrc="https://www.nebelspiegel.com/images/shopping-bag.svg"
            iconWidth={17}
            iconHeight={17}
          />
        ) : null}
        <NavIcon
          href="/account"
          label="Account"
          iconSrc="https://www.nebelspiegel.com/images/profile.svg"
          iconWidth={19}
          iconHeight={19}
        />
      </div>
    </div>
  );
}

function NavIcon({
  href,
  label,
  active,
  iconSrc,
  iconWidth,
  iconHeight,
}: {
  href: string;
  label: string;
  active?: boolean;
  iconSrc: string;
  iconWidth: number;
  iconHeight: number;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-1 ${active ? "text-white" : "text-white/60 hover:text-white/85"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- byte-for-byte source markup, not a Next-optimized image */}
      <img
        src={iconSrc}
        alt=""
        width={iconWidth}
        height={iconHeight}
        className={active ? "opacity-100" : "opacity-60"}
      />
      <span className="text-[9px] uppercase tracking-[0.08em]">{label}</span>
    </Link>
  );
}
