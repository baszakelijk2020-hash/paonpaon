import type { AdvisorPreparationBrief } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";

function polarityLabel(polarity: string): string {
  if (polarity === "positive") return "Likes";
  if (polarity === "negative") return "Avoids";
  return "Neutral";
}

function personalizationMessage(status: AdvisorPreparationBrief["personalizationStatus"]): string {
  if (status === "consent_withdrawn") {
    return "Personalization consent was withdrawn. Recent interests, shortlist, and inferred style signals are hidden. Orders, messages, and team notes remain available.";
  }
  if (status === "consent_denied") {
    return "Personalization consent was not granted. Signal-based preparation is unavailable until the client opts in.";
  }
  return "";
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-stone-500)]">
        {title}
      </p>
      {children}
      {empty ? (
        <p className="text-sm text-[var(--color-stone-500)]">{empty}</p>
      ) : null}
    </div>
  );
}

/**
 * Consented advisor preparation brief (ADV-003 / PHASE 3.3). Renders an
 * explainable projection with source/recency — no generated facts.
 */
export function AdvisorBriefPanel({
  brief,
  compact = false,
}: {
  brief: AdvisorPreparationBrief;
  compact?: boolean;
}) {
  const withheld = brief.personalizationStatus !== "available";
  const consentCopy = personalizationMessage(brief.personalizationStatus);

  return (
    <Card className="rounded-[var(--radius-md)]">
      <div className="mb-5">
        <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
          Advisor preparation brief
        </p>
        <h2 className="font-display mt-2 text-2xl">
          {compact ? "Continue the conversation" : "What to prepare"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-stone-500)]">
          Consented interests, saved pieces, knowledge, and style evidence —
          with source and recency. Wardrobe gaps arrive in a later programme
          stage.
        </p>
      </div>

      {consentCopy ? (
        <div
          role="status"
          className="mb-5 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-[var(--color-stone-50)] p-4 text-sm leading-6 text-[var(--color-stone-700)]"
        >
          {consentCopy}
        </div>
      ) : null}

      {brief.occasion ? (
        <div className="mb-5 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-[var(--color-stone-50)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
            Occasion / need
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--color-stone-900)]">
            {brief.occasion.label}
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Recent interests"
          empty={
            withheld
              ? undefined
              : brief.interests.length === 0
                ? "No consented activity yet."
                : undefined
          }
        >
          {brief.interests.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {brief.interests.map((interest, index) => (
                <li
                  key={`${interest.eventName}-${interest.occurredAt}-${index}`}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <span className="text-[var(--color-stone-800)]">
                    {interest.detail
                      ? `${interest.label} — ${interest.detail}`
                      : interest.label}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--color-stone-500)]">
                    {formatDate(interest.occurredAt, "en-US")}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Section>

        <Section
          title="Shortlist"
          empty={
            withheld
              ? undefined
              : brief.shortlist.length === 0
                ? "Nothing saved yet."
                : undefined
          }
        >
          {brief.shortlist.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {brief.shortlist.map((item) => (
                <li
                  key={`${item.productId}-${item.savedAt}`}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <span className="text-[var(--color-stone-800)]">
                    {item.productName}
                    {item.variantLabel ? ` (${item.variantLabel})` : ""}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--color-stone-500)]">
                    {formatDate(item.savedAt, "en-US")}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Section>

        <Section
          title="Knowledge explored"
          empty={
            withheld
              ? undefined
              : brief.knowledge.length === 0
                ? "No knowledge cards opened yet."
                : undefined
          }
        >
          {brief.knowledge.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {brief.knowledge.map((item, index) => (
                <li
                  key={`${item.title}-${item.occurredAt}-${index}`}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <span className="text-[var(--color-stone-800)]">
                    {item.title}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--color-stone-500)]">
                    {formatDate(item.occurredAt, "en-US")}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Section>

        <Section
          title="Style signals"
          empty={
            withheld
              ? undefined
              : brief.stylePreferences.length === 0
                ? "No declared or inferred preferences yet."
                : undefined
          }
        >
          {brief.stylePreferences.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {brief.stylePreferences.map((pref, index) => (
                <li
                  key={`${pref.conceptLabel}-${pref.kind}-${index}`}
                  className="text-sm text-[var(--color-stone-800)]"
                >
                  <span className="font-medium">{pref.conceptLabel}</span>
                  {" · "}
                  {polarityLabel(pref.polarity)}
                  {pref.kind === "inferred" && pref.confidence !== undefined
                    ? ` · ${Math.round(pref.confidence * 100)}%`
                    : ""}
                  <span className="block text-xs text-[var(--color-stone-500)]">
                    {pref.source} · {formatDate(pref.lastEvidenceAt, "en-US")}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Section>

        <Section
          title="Evidence highlights"
          empty={
            withheld
              ? undefined
              : brief.recentEvidence.length === 0
                ? "No active evidence rows."
                : undefined
          }
        >
          {brief.recentEvidence.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {brief.recentEvidence.map((row, index) => (
                <li
                  key={`${row.conceptLabel}-${row.source}-${index}`}
                  className="text-sm text-[var(--color-stone-800)]"
                >
                  {row.conceptLabel} · {row.source.replaceAll("_", " ")} ·{" "}
                  {polarityLabel(row.polarity)}
                  <span className="block text-xs text-[var(--color-stone-500)]">
                    {formatDate(row.occurredAt, "en-US")}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Section>

        <Section
          title="Questions & continuity"
          empty={
            brief.questions.length === 0 && brief.conversationContinuity.length === 0
              ? "No recent messages or advisor questions."
              : undefined
          }
        >
          {brief.questions.length > 0 ? (
            <ul className="mb-4 flex flex-col gap-2">
              {brief.questions.map((question, index) => (
                <li
                  key={`${question.source}-${question.occurredAt}-${index}`}
                  className="rounded-[var(--radius-md)] bg-[var(--color-stone-50)] p-3 text-sm leading-6"
                >
                  {question.body}
                  <span className="mt-1 block text-xs text-[var(--color-stone-500)]">
                    {question.source === "message" ? "Message" : "Storefront question"} ·{" "}
                    {formatDate(question.occurredAt, "en-US")}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {brief.conversationContinuity.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {brief.conversationContinuity.map((line, index) => (
                <li
                  key={`${line.sender}-${line.occurredAt}-${index}`}
                  className="text-sm leading-6 text-[var(--color-stone-700)]"
                >
                  <span className="font-medium capitalize">{line.sender}:</span>{" "}
                  {line.body}
                  <span className="block text-xs text-[var(--color-stone-500)]">
                    {formatDate(line.occurredAt, "en-US")}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Section>
      </div>

      <p className="mt-6 text-xs text-[var(--color-stone-500)]">
        Wardrobe gap analysis is not available yet — it ships with wardrobe
        intelligence (PHASE 4).
      </p>
    </Card>
  );
}
