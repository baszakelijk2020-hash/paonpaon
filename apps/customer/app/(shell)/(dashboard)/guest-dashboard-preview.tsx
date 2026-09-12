import { getStorefrontPageData } from "../r/[slug]/get-storefront-page-data";

import { GuestWardrobeBackdrop } from "./guest-wardrobe-backdrop";

const DEMO_RETAILER_SLUG = "atelier-demo";

/**
 * The unauthenticated dashboard backdrop deliberately consumes only the
 * public storefront projection. It is visual context for the sign-in gate,
 * never a guest customer environment or an interactive catalogue surface.
 */
export async function GuestDashboardPreview() {
  try {
    const storefront = await getStorefrontPageData(DEMO_RETAILER_SLUG);
    if (!storefront) return <GuestWardrobeBackdrop />;

    const products = storefront.entries
      .filter((entry) => entry.img)
      .slice(0, 4);

    if (products.length === 0) return <GuestWardrobeBackdrop />;

    return (
      <div
        aria-hidden="true"
        inert
        className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden"
      >
        {/* Fixed 1600px wide, not the viewport: a blurred layer this size is
            re-rasterised on every frame its layout changes, and tying it to
            the window made every resize a full-page blur pass — the renderer
            fell behind and Chrome painted grey where the page should be.
            Laid out once, it only gets clipped by the wrapper as the window
            moves. */}
        <div
          className="flex min-h-full flex-col [filter:blur(20px)]"
          style={{ width: "1600px", willChange: "transform" }}
        >
          <header className="flex h-[62px] items-center justify-between border-b border-black/10 px-10 text-[#30312f]">
            <span className="text-[11px] uppercase tracking-[0.18em] [font-family:GTBold3,Arial,sans-serif]">
              {storefront.retailerNameRaw}
            </span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-black/45 [font-family:GTBold3,Arial,sans-serif]">
              My PAON
            </span>
          </header>

          <section className="px-14 pb-10 pt-12 text-[#30312f]">
            <p className="text-[10px] uppercase tracking-[0.2em] text-black/45 [font-family:GTBold3,Arial,sans-serif]">
              Wardrobe overview
            </p>
            <h1 className="mt-4 text-[54px] font-light leading-none tracking-[-0.04em] [font-family:OptimaKlein,serif]">
              Your considered wardrobe.
            </h1>
          </section>

          <section className="flex-1 px-14 pb-14">
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
              {products.map((product) => (
                <article key={product.id} className="min-w-0">
                  <div className="aspect-[3/4] overflow-hidden bg-black/[0.04]">
                    {/* Public retailer image hosts vary per tenant; retain the raw
                     * projection URL instead of imposing a Next image allowlist. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.img}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p className="mt-4 truncate text-[15px] [font-family:OptimaKlein,serif]">
                    {product.name}
                  </p>
                  {product.price ? (
                    <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-black/45 [font-family:GTBold3,Arial,sans-serif]">
                      {product.price}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  } catch {
    return <GuestWardrobeBackdrop />;
  }
}
