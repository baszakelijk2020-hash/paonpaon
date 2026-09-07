const garmentCards = [
  {
    height: "h-44",
    shade: "bg-stone-200",
    silhouette: "rounded-t-[38%] rounded-b-[18%]",
  },
  {
    height: "h-52",
    shade: "bg-zinc-300",
    silhouette: "rounded-t-[44%] rounded-b-[12%]",
  },
  {
    height: "h-40",
    shade: "bg-neutral-200",
    silhouette: "rounded-t-[32%] rounded-b-[20%]",
  },
  {
    height: "h-48",
    shade: "bg-stone-300",
    silhouette: "rounded-t-[46%] rounded-b-[16%]",
  },
];

/** Decorative, intentionally non-interactive context behind the guest sign-in card. */
export function GuestWardrobeBackdrop() {
  return (
    <div
      aria-hidden="true"
      inert
      className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden"
    >
      <div className="absolute inset-0 bg-[#f7f7f5] blur-[20px]">
        <div className="mx-auto flex h-full max-w-[1180px] flex-col px-10 pt-11">
          <header className="flex items-end justify-between border-b border-black/[0.09] pb-5">
            <div>
              <p className="text-[10px] font-medium tracking-[0.22em] text-black/45">
                MY PAON
              </p>
              <h2 className="mt-2 text-[28px] font-light tracking-[-0.04em] text-black/80">
                Wardrobe
              </h2>
            </div>
            <div className="flex gap-7 text-[10px] font-medium tracking-[0.16em] text-black/45">
              <span className="text-black/80">OVERVIEW</span>
              <span>GARMENTS</span>
              <span>LOOKS</span>
            </div>
          </header>

          <section className="mt-10 grid grid-cols-4 gap-5" aria-hidden="true">
            {garmentCards.map((garment, index) => (
              <div
                key={index}
                className="h-[285px] border border-black/[0.07] bg-white p-5"
              >
                <div className="flex h-[210px] items-end justify-center bg-[#f3f3f1]">
                  <div
                    className={`${garment.height} ${garment.shade} ${garment.silhouette} w-[62%]`}
                  />
                </div>
                <div className="mt-4 h-px w-14 bg-black/15" />
                <div className="mt-2 h-px w-24 bg-black/[0.08]" />
              </div>
            ))}
          </section>

          <div className="mt-7 grid grid-cols-[1.35fr_0.65fr] gap-5">
            <div className="h-32 border border-black/[0.07] bg-white/70" />
            <div className="h-32 border border-black/[0.07] bg-[#eeeeeb]" />
          </div>
        </div>
      </div>
    </div>
  );
}
