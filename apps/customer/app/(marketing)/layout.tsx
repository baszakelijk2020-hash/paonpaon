import type { Metadata } from "next";
import Link from "next/link";

import { MarketingHeader } from "./marketing-header";

export const metadata: Metadata = {
  title: "Premium retail, connected",
  description:
    "PAON connects the storefront, the atelier and the client relationship for independent premium retail houses.",
  openGraph: {
    title: "PAON — premium retail, connected",
    description:
      "See how a made-to-measure house runs appointments, fittings and client stories in one composed system.",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f4f1ec] text-[#1a1a1a]">
      <MarketingHeader />
      {children}
      <footer className="bg-[#1a1a1a] px-5 py-14 text-white sm:px-8">
        <div className="mx-auto grid max-w-[92rem] gap-10 md:grid-cols-[1fr_auto]">
          <div>
            <p className="font-display text-4xl tracking-[0.18em]">PAON</p>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/55">
              The digital customer and operating platform for premium retail
              houses.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm text-white/70">
            <Link href="/pricing">Packages</Link>
            <Link href="/consultation">Consultation</Link>
            <Link href="/discover/roles">Retailer roles</Link>
            <Link href="/founder">Founder</Link>
            <Link href="/pilot">Paid pilot</Link>
            <Link href="/r/maison-dubois">Live store</Link>
            <Link href="/login">Customer sign in</Link>
            <Link href="/demo-request">Personalized demo</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
