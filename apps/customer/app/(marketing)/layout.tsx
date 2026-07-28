import Link from "next/link";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f4f1ec] text-[#1a1a1a]">
      <header className="glass-panel fixed inset-x-0 top-0 z-50 border-b border-black/10">
        <div className="mx-auto flex h-16 max-w-[92rem] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="font-display text-xl tracking-[0.28em]">
            PAON
          </Link>
          <nav
            aria-label="PAON corporate navigation"
            className="hidden items-center gap-7 text-xs md:flex"
          >
            <Link href="/discover/platform">Platform</Link>
            <Link href="/discover/alterations">Alterations</Link>
            <Link href="/discover/engagement">Engagement</Link>
            <Link href="/discover/weddings-events">Weddings</Link>
            <Link href="/founder">Founder</Link>
            <Link href="/pricing">Packages</Link>
            <Link href="/r/maison-dubois">Live store</Link>
          </nav>
          <Link
            href="/demo-request"
            className="inline-flex min-h-10 items-center rounded-[var(--radius-sm)] bg-[#1a1a1a] px-4 text-xs font-medium text-white"
          >
            View a personalized demo
          </Link>
        </div>
      </header>
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
