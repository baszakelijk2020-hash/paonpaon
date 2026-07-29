import Link from "next/link";
import { notFound } from "next/navigation";

const TOPICS = {
  platform: {
    eyebrow: "The PAON platform",
    title: "One customer story. Every operating role.",
    introduction:
      "PAON connects the moments premium retailers usually scatter across ecommerce, inboxes, appointment calendars, workshop notes and spreadsheets.",
    image: "https://www.nebelspiegel.com/images/smaller/6054.webp",
    moments: [
      ["Discover", "Editorial storefront, saved pieces and private events"],
      [
        "Recognize",
        "One client record with preferences and relationship history",
      ],
      ["Serve", "Appointments prepared with the context an advisor needs"],
      ["Deliver", "Orders and garments progress through accountable handoffs"],
    ],
  },
  outcomes: {
    eyebrow: "Retailer outcomes",
    title: "More reasons to return. Fewer promises left invisible.",
    introduction:
      "The value is not another database. It is clearer service, consistent follow-through and a customer experience that continues after a purchase.",
    image: "https://www.nebelspiegel.com/images/smaller/6078.webp",
    moments: [
      ["Attention", "Every role begins with what needs action now"],
      [
        "Continuity",
        "Customer context travels into appointments and follow-up",
      ],
      ["Confidence", "Progress and responsibility remain visible"],
      [
        "Growth",
        "Recognition, events and thoughtful follow-up create relevant return moments",
      ],
    ],
  },
  alterations: {
    eyebrow: "Alterations",
    title: "A fitting becomes a complete visual operation.",
    introduction:
      "Garment identity, fitting observations, approved tasks, price decisions, workshop custody, evidence and customer readiness remain one accountable story.",
    image: "https://www.nebelspiegel.com/images/smaller/6066.webp",
    moments: [
      ["Fitting", "Capture the physical garment and precise observation"],
      ["Approval", "Agree work and price before responsibility moves"],
      ["Workroom", "Assign only approved work with due dates and evidence"],
      ["Handoff", "Review quality and notify the customer at readiness"],
    ],
  },
  engagement: {
    eyebrow: "Customer engagement",
    title: "Clienteling that feels personal because the context is real.",
    introduction:
      "Advisors see preferences, recent behavior, appointments, pieces and private notes together—then continue the same relationship through messaging and invitations.",
    image: "https://www.nebelspiegel.com/images/smaller/6082.webp",
    moments: [
      ["Know", "Pinned preferences and relationship history"],
      ["Prepare", "Appointment context before the client arrives"],
      ["Continue", "Advisor conversation without losing the record"],
      ["Invite", "Events, wedding parties and considered recommendations"],
    ],
  },
  templates: {
    eyebrow: "Website and storefront templates",
    title: "Your house, expressed through one curated system.",
    introduction:
      "Validated color, type, imagery and content tokens shape a distinctive retailer experience without unsafe code, arbitrary CSS or a duplicated application.",
    image: "https://www.nebelspiegel.com/images/smaller/6059.webp",
    moments: [
      ["Identity", "Logo, favicon, curated typography and color tokens"],
      ["Editorial", "Image-led products and collection stories"],
      ["Responsive", "Desktop, tablet and mobile from the same components"],
      ["Safe", "No scripts, arbitrary markup or per-retailer forks"],
    ],
  },
  loyalty: {
    eyebrow: "Loyalty and referrals",
    title: "Recognition should deepen a relationship—not cheapen it.",
    introduction:
      "PAON combines points, tiers, meaningful rewards and attributable referrals with the wider client story so recognition remains relevant.",
    image: "https://www.nebelspiegel.com/images/smaller/6065_1.webp",
    moments: [
      ["Recognize", "Visible standing and considered rewards"],
      ["Reward", "Tier-aware value without generic discount clutter"],
      ["Refer", "Track a personal introduction through first purchase"],
      ["Understand", "See loyalty alongside service and commercial signals"],
    ],
  },
  "weddings-events": {
    eyebrow: "Weddings and events",
    title: "Complex group moments, held with calm.",
    introduction:
      "Coordinate organizers, members, invitations, fitting readiness and event response without losing the individual relationship behind the group.",
    image: "https://www.nebelspiegel.com/images/smaller/6071_1.webp",
    moments: [
      ["Plan", "One group view with ownership and milestones"],
      ["Invite", "Secure joining and clear private-event response"],
      ["Fit", "Member-by-member readiness without spreadsheet drift"],
      ["Follow through", "Keep every individual connected to the retailer"],
    ],
  },
  roles: {
    eyebrow: "Role-specific operations",
    title: "Relevance is an interface decision.",
    introduction:
      "Owners, managers, advisors, operations teams, workshop managers, alteration workers and customers share truth—but never the same crowded screen.",
    image: "https://www.nebelspiegel.com/images/smaller/6088_1.webp",
    moments: [
      ["Owner", "Commercial pressure, approvals and team health"],
      ["Advisor", "Today’s clients, context and follow-through"],
      ["Operations", "Promises that must advance"],
      ["Workshop", "Assigned garments, approved work and evidence"],
    ],
  },
} as const;

export function generateStaticParams() {
  return Object.keys(TOPICS).map((topic) => ({ topic }));
}

export default async function DiscoverPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic } = await params;
  const content = TOPICS[topic as keyof typeof TOPICS];
  if (!content) notFound();

  return (
    <main>
      <section className="relative isolate min-h-[42rem] overflow-hidden bg-black px-5 pb-16 pt-32 text-white sm:px-8">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-cover bg-center opacity-55"
          style={{ backgroundImage: `url(${content.image})` }}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black via-black/70 to-black/10" />
        <div className="mx-auto flex min-h-[32rem] max-w-[92rem] flex-col justify-end">
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/55">
            {content.eyebrow}
          </p>
          <h1 className="font-display mt-6 max-w-5xl text-6xl leading-[0.9] sm:text-8xl">
            {content.title}
          </h1>
        </div>
      </section>
      <section className="px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto grid max-w-[92rem] gap-16 lg:grid-cols-[0.8fr_1.2fr]">
          <p className="max-w-lg text-lg leading-8 text-black/55">
            {content.introduction}
          </p>
          <div className="divide-y divide-black/15 border-t border-black/15">
            {content.moments.map(([label, detail], index) => (
              <div
                key={label}
                className="grid gap-4 py-7 sm:grid-cols-[3rem_9rem_1fr]"
              >
                <span className="font-mono text-xs text-black/35">
                  0{index + 1}
                </span>
                <h2 className="font-display text-2xl">{label}</h2>
                <p className="text-sm leading-6 text-black/50">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-[#1a1a1a] px-5 py-24 text-white sm:px-8">
        <div className="mx-auto flex max-w-[92rem] flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <h2 className="font-display max-w-3xl text-5xl leading-none sm:text-7xl">
            See this through your retailer’s eyes.
          </h2>
          <div className="flex flex-wrap gap-5 text-sm">
            {topic === "weddings-events" ? (
              <Link
                href="/login?demo=1&email=contact%2Bisabelle%40nebelspiegel.com&redirectTo=%2Fwedding-parties"
                className="underline underline-offset-4"
              >
                Open the live wedding party demo
              </Link>
            ) : null}
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
