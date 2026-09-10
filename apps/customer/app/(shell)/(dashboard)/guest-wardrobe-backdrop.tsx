const overviewTabs = [
  "Overview",
  "Wardrobe",
  "My Appointments",
  "Orders",
  "Digital Fitting Room",
  "Rewards & Referrals",
  "My Profile",
];

const sectionRows = [
  { title: "Upcoming occasions", cards: 3 },
  { title: "The daily edit", cards: 4 },
  { title: "Complete the look", cards: 4 },
];

/** Wardrobe → Overview tab, rendered as it looks once signed in. Sits behind
 * the guest sign-in card, non-interactive; no blur, no tint. The real page
 * needs a session, so a guest sees this faithful stand-in. */
export function GuestWardrobeBackdrop() {
  return (
    <div
      aria-hidden="true"
      inert
      className="absolute inset-0 z-0 select-none overflow-hidden bg-[#ece9e1]"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-stretch gap-7 border-b border-black/10 bg-white px-10 text-[12px] font-medium tracking-[0.01em] text-black/45">
          {overviewTabs.map((tab, index) => (
            <span
              key={tab}
              className={`whitespace-nowrap py-4 ${
                index === 0 ? "border-b-2 border-black/80 text-black/85" : ""
              }`}
            >
              {tab}
            </span>
          ))}
        </div>

        <section className="bg-[#ece9e1] px-14 py-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#6a6d65]">
            Outfit of the day
          </p>
          <h1 className="mt-4 max-w-2xl text-[58px] font-light leading-[1.03] tracking-[-0.02em] text-[#26271f]">
            Your next considered look.
          </h1>
          <div className="mt-9 flex items-end gap-5">
            <div className="h-[300px] w-[220px] rounded-[3px] bg-[#dcd7ca]" />
            <div className="h-[240px] w-[180px] rounded-[3px] bg-[#e0dbcf]" />
            <div className="hidden h-[190px] w-[180px] rounded-[3px] bg-[#e4dfd3] lg:block" />
          </div>
        </section>

        <div className="flex flex-col gap-11 bg-white px-14 py-11">
          {sectionRows.map((row) => (
            <div key={row.title}>
              <h2 className="text-[22px] font-light tracking-[-0.02em] text-black/80">
                {row.title}
              </h2>
              <div className="mt-5 grid grid-cols-4 gap-6">
                {Array.from({ length: row.cards }).map((_, index) => (
                  <div
                    key={index}
                    className="overflow-hidden rounded-[3px] border border-black/[0.06] bg-white shadow-[0_12px_34px_rgba(0,0,0,0.06)]"
                  >
                    <div className="h-[168px] bg-[#e2ddd1]" />
                    <div className="m-4 h-[9px] w-2/3 rounded-full bg-black/15" />
                    <div className="mx-4 mb-5 h-[9px] w-1/3 rounded-full bg-black/[0.10]" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
