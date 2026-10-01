import Link from "next/link";

import { AddressSearchFields } from "./address-search-fields";

export function GuestAddressPreview() {
  return (
    <section
      className="pe-card rounded-[32px] bg-[#191b1d] p-7 text-white"
      data-pe-card
    >
      <p className="customer-kicker text-white/55">Delivery locations</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
        Home and work
      </h2>
      <p className="mt-2 max-w-xl text-sm text-white/60">
        Search an address now. Sign in to save it for appointments, delivery and
        your morning routine.
      </p>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h3 className="mb-4 text-base font-semibold text-white">Home</h3>
          <AddressSearchFields label="home" initialAddress={undefined} />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h3 className="mb-4 text-base font-semibold text-white">Work</h3>
          <AddressSearchFields label="work" initialAddress={undefined} />
        </div>
      </div>
      <Link
        href="/login?redirectTo=%2Faccount"
        className="mt-6 inline-flex min-h-11 items-center rounded-full border border-white/20 px-5 text-sm text-white transition hover:border-[#b8e6be] hover:text-[#c9ebce]"
      >
        Sign in to save addresses
      </Link>
    </section>
  );
}
