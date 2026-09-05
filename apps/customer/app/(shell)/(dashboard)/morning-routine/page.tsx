import { RelatedLinks } from "../related-links";

import { LocalWidgets } from "./local-widgets";
import { RoutineSections } from "./routine-sections";

export default async function MorningRoutinePage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="customer-page-header flex-col items-start sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="customer-kicker">Daily edit</p>
          <h1 className="font-display mt-3 text-4xl leading-none tracking-[-0.045em] text-[var(--customer-ink)] sm:text-5xl">
            Morning routine
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--color-stone-600)]">
            A considered daily edit shaped by your wardrobe, local conditions,
            and the occasions ahead.
          </p>
        </div>
        <RelatedLinks
          links={[
            { href: "/for-you", label: "For You" },
            { href: "/style-quiz", label: "Style Quiz" },
            { href: "/silhouette-analysis", label: "Silhouette Analysis" },
          ]}
        />
      </header>

      <LocalWidgets />

      <RoutineSections />
    </div>
  );
}
