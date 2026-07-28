import Link from "next/link";

const PARAGRAPHS = [
  "Menswear has been part of my life since I was 14 years old.",
  "I started my journey in a formal menswear store, where I spent my weekends learning about fabrics, garment construction, fit, and the craftsmanship that transforms a good suit into an exceptional one.",
  "At 16, the store introduced made-to-measure. It completely changed how I viewed menswear. I realised that a great suit wasn't just about the cloth or the construction—it was about understanding the individual wearing it. Every client had different preferences, different proportions, and different expectations. Helping translate those into a garment that fit both their body and personality became the part of the job I enjoyed most.",
  "After my studies, I started my own made-to-measure tailoring business. Initially, I operated as a travelling tailor, visiting clients throughout the Netherlands and, over time, internationally. Later, I established a private showroom at my home in Amsterdam, where I continued serving clients while travelling regularly for appointments and fittings.",
  "Working directly with clients was always the highlight. I enjoyed advising them, building long-term relationships, helping them develop their wardrobes, and seeing the confidence that comes from clothing that genuinely fits them.",
  "Running the business, however, exposed a different reality.",
  "Like many independent retailers, I found myself spending an increasing amount of time on administration rather than customers. Managing appointments, customer records, measurements, invoicing, follow-ups, alterations, referrals, loyalty programmes, and supplier communication often meant juggling spreadsheets, notes, WhatsApp conversations, emails, and disconnected tools. None of it reflected how a made-to-measure business actually operates.",
  "As a smaller business, investing in expensive enterprise software wasn't realistic. The systems that did exist were either generic retail software or built for large organisations. They understood stock and transactions, but not relationships, measurements, fittings, alterations, or the personal service that defines bespoke menswear.",
  "So I began building my own tools.",
  "At first, they were simply solutions for my own business—software to organise customers, measurements, appointments, referrals, loyalty, and the countless operational details that happen before and after a sale. The more I built, the more I realised these weren't just my problems. Almost every independent made-to-measure retailer I spoke to faced the same frustrations.",
  "That realisation became the foundation of this platform.",
  "It isn't software designed by people trying to understand the industry from the outside. It's being built by someone who has measured clients, travelled to appointments, worked with alteration workshops, managed repeat customers, and experienced first-hand the operational challenges of running a made-to-measure business.",
  "Every feature starts with the same question: Would this have made my own business better?",
  "If the answer is yes, it has the potential to help other retailers spend less time on administration, make better decisions, improve the customer experience, and focus on what they do best: serving their clients.",
] as const;

export default function FounderPage() {
  return (
    <main>
      <section className="bg-[#f4f1ec] px-5 pb-10 pt-32 sm:px-8 sm:pb-14 sm:pt-36">
        <div className="mx-auto max-w-[42rem]">
          <p className="font-accent text-[10px] uppercase tracking-[0.22em] text-black/45">
            The founder
          </p>
          <h1 className="font-display mt-5 text-5xl leading-[0.95] tracking-[-0.03em] text-[#111110] sm:text-7xl">
            Why I built this
          </h1>
        </div>
      </section>

      <section className="bg-[#f4f1ec] px-5 pb-24 sm:px-8 sm:pb-32">
        <article className="mx-auto max-w-[42rem]">
          <div className="space-y-7 text-base leading-8 text-[#2a2925] sm:text-lg sm:leading-9">
            {PARAGRAPHS.map((paragraph) => (
              <p key={paragraph.slice(0, 48)}>{paragraph}</p>
            ))}
            <p className="font-display pt-4 text-2xl leading-snug tracking-[-0.02em] text-[#111110] sm:text-3xl">
              I&apos;m not building software for the menswear industry.
            </p>
            <p className="font-display text-2xl leading-snug tracking-[-0.02em] text-[#111110] sm:text-3xl">
              I&apos;m building the platform I always wished I&apos;d had.
            </p>
          </div>
        </article>
      </section>

      <section className="bg-[#1a1a1a] px-5 py-24 text-white sm:px-8">
        <div className="mx-auto flex max-w-[92rem] flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <h2 className="font-display max-w-3xl text-5xl leading-none sm:text-7xl">
            See it through a retailer&apos;s eyes.
          </h2>
          <div className="flex flex-wrap gap-5 text-sm">
            <Link href="/demo-request" className="underline underline-offset-4">
              View a personalized demonstration
            </Link>
            <Link href="/consultation" className="underline underline-offset-4">
              Book a consultation
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
