import type { AdvisorPreparationBrief } from "@paon/domain";
import { CONVERSATION_INTENT_LABELS } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Link from "next/link";
import type { ReactNode } from "react";

const VISIBILITY_COPY: Record<
  AdvisorPreparationBrief["visibility"],
  {
    readonly title: string;
    readonly body: string;
    readonly tone: "success" | "warning" | "neutral";
  }
> = {
  usable: {
    title: "Consented intelligence",
    body: "Showing same-retailer signals the client has opted into.",
    tone: "success",
  },
  consent_denied: {
    title: "Personalization not opted in",
    body: "Prepare from the appointment request, pinned notes, and conversation only.",
    tone: "neutral",
  },
  consent_withdrawn: {
    title: "Personalization withdrawn",
    body: "Withdrawn signals are hidden. Continue from operational relationship records only.",
    tone: "warning",
  },
  consent_missing: {
    title: "Consent unavailable",
    body: "No usable personalization consent for this relationship.",
    tone: "neutral",
  },
};

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty?: string;
  children: ReactNode;
}) {
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-stone-500)]">
        {title}
      </p>
      {hasChildren ? (
        children
      ) : (
        <p className="text-sm text-[var(--color-stone-500)]">
          {empty ?? "Nothing recorded yet."}
        </p>
      )}
    </div>
  );
}

/**
 * Mounts the ADV-003 advisor preparation brief into the existing Retailer
 * Portal client / appointment workspace without inventing facts.
 */
export function AdvisorPreparationBriefCard({
  brief,
  conversationHref,
  compact = false,
}: {
  brief: AdvisorPreparationBrief;
  conversationHref?: string;
  compact?: boolean;
}) {
  const visibility = VISIBILITY_COPY[brief.visibility];
  const usable = brief.visibility === "usable";

  return (
    <Card
      className="rounded-[var(--radius-md)]"
      aria-labelledby="advisor-preparation-brief-heading"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
            Advisor preparation
          </p>
          <h2
            id="advisor-preparation-brief-heading"
            className="font-display mt-2 text-2xl sm:text-3xl"
          >
            Continue the online conversation
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-stone-500)]">
            Consented interests, shortlist, evidence, and questions for this
            retailer relationship — fail closed when consent is absent.
          </p>
        </div>
        <Badge tone={visibility.tone}>{visibility.title}</Badge>
      </div>

      <p className="mb-5 text-sm text-[var(--color-stone-600)]" role="status">
        {visibility.body}
      </p>

      {brief.likelyNeed ? (
        <div className="mb-5 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-[var(--color-stone-50)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
            Likely need
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--color-stone-900)]">
            {brief.likelyNeed.summary}
          </p>
          <p className="mt-1 text-xs text-[var(--color-stone-500)]">
            {brief.likelyNeed.source.replaceAll("_", " ")} ·{" "}
            {formatDate(brief.likelyNeed.occurredAt, "en-US")}
          </p>
        </div>
      ) : null}

      <div
        className={
          compact ? "flex flex-col gap-5" : "grid gap-5 md:grid-cols-2"
        }
      >
        <Section
          title="Recent interests"
          empty={
            usable
              ? "No consented interests yet."
              : "Interests hidden without personalization consent."
          }
        >
          {brief.interests.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {brief.interests.slice(0, compact ? 4 : 8).map((item) => (
                <li
                  key={`${item.source}-${item.label}-${item.occurredAt}`}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <span className="text-[var(--color-stone-800)]">
                    {item.label}
                    <span className="mt-0.5 block text-xs text-[var(--color-stone-500)]">
                      {item.source.replaceAll("_", " ")}
                    </span>
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
          title="Shortlist"
          empty={
            usable
              ? "No saved or favorited pieces yet."
              : "Shortlist hidden without personalization consent."
          }
        >
          {brief.shortlist.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {brief.shortlist.slice(0, compact ? 4 : 8).map((item) => (
                <li
                  key={`${item.source}-${item.productVariantId ?? item.productId ?? item.label}`}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <span className="text-[var(--color-stone-800)]">
                    {item.label}
                    <span className="mt-0.5 block text-xs text-[var(--color-stone-500)]">
                      {item.source.replaceAll("_", " ")}
                    </span>
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
          title="Knowledge consumed"
          empty={
            usable
              ? "No knowledge cards opened yet."
              : "Knowledge history hidden without personalization consent."
          }
        >
          {brief.knowledgeConsumed.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {brief.knowledgeConsumed.slice(0, 6).map((item) => (
                <li
                  key={`${item.knowledgeObjectId ?? item.label}-${item.occurredAt}`}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <span className="text-[var(--color-stone-800)]">
                    {item.label}
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
          title="Evidence"
          empty={
            usable
              ? "No StyleProfile evidence yet."
              : "Evidence hidden without personalization consent."
          }
        >
          {brief.evidence.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {brief.evidence.slice(0, compact ? 4 : 8).map((item) => (
                <li
                  key={item.evidenceId}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <span className="text-[var(--color-stone-800)]">
                    {item.conceptLabel}
                    <span className="mt-0.5 block text-xs text-[var(--color-stone-500)]">
                      {item.source.replaceAll("_", " ")} · {item.polarity}
                      {item.stale ? " · stale" : ""}
                    </span>
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
          title="Questions"
          empty={
            usable
              ? "No customer questions captured yet."
              : "Personalization questions hidden; open the conversation for operational messages."
          }
        >
          {brief.questions.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {brief.questions.slice(0, compact ? 3 : 6).map((item) => (
                <li
                  key={item.id}
                  className="rounded-[var(--radius-md)] bg-[var(--color-stone-50)] px-3 py-2 text-sm text-[var(--color-stone-800)]"
                >
                  {item.body}
                  <span className="mt-1 block text-xs text-[var(--color-stone-500)]">
                    {item.source.replaceAll("_", " ")} ·{" "}
                    {formatDate(item.occurredAt, "en-US")}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Section>

        <Section title="Preparation" empty="No preparation hints yet.">
          {brief.preparationSuggestions.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {brief.preparationSuggestions.map((item) => (
                <li
                  key={item.code}
                  className="text-sm leading-6 text-[var(--color-stone-800)]"
                >
                  {item.text}
                </li>
              ))}
            </ul>
          ) : null}
        </Section>
      </div>

      {brief.occasion ? (
        <p className="mt-5 text-sm text-[var(--color-stone-600)]">
          Occasion: <span className="font-medium">{brief.occasion.label}</span>
          <span className="text-[var(--color-stone-500)]">
            {" "}
            · {brief.occasion.source.replaceAll("_", " ")}
          </span>
        </p>
      ) : null}

      {brief.conversation ? (
        <div className="mt-5 border-t border-[var(--color-stone-100)] pt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-stone-500)]">
            Online conversation
          </p>
          {brief.conversation.intent ? (
            <p className="mb-3 text-sm text-[var(--color-stone-700)]">
              Intent: {CONVERSATION_INTENT_LABELS[brief.conversation.intent]}
            </p>
          ) : null}
          {brief.conversation.recentMessages.length > 0 ? (
            <ul className="mb-4 flex flex-col gap-2">
              {brief.conversation.recentMessages.slice(-4).map((item) => (
                <li
                  key={item.id}
                  className="text-sm text-[var(--color-stone-700)]"
                >
                  <span className="text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
                    {item.senderType.replaceAll("_", " ")}
                  </span>
                  <span className="mt-0.5 block">{item.body}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-[var(--color-stone-500)]">
              Conversation exists but has no messages yet.
            </p>
          )}
          {conversationHref ? (
            <Link
              href={conversationHref}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Open conversation
            </Link>
          ) : null}
        </div>
      ) : null}

      {brief.wardrobeGaps.length > 0 ? (
        <div className="mt-5">
          <Section
            title="Wardrobe gaps"
            empty="No ranked gaps on the approved plan."
          >
            <ul className="flex flex-col gap-1.5">
              {brief.wardrobeGaps.slice(0, compact ? 4 : 8).map((gap) => (
                <li
                  key={gap.gapId}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <span className="text-[var(--color-stone-800)]">
                    #{gap.rank} {gap.title}
                    {gap.howPurchaseFillsGap ? (
                      <span className="mt-0.5 block text-xs text-[var(--color-stone-500)]">
                        {gap.howPurchaseFillsGap}
                      </span>
                    ) : null}
                  </span>
                  {gap.slotKind ? (
                    <span className="shrink-0 text-xs text-[var(--color-stone-500)]">
                      {gap.slotKind.replaceAll("_", " ")}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>
        </div>
      ) : (
        <p className="mt-5 text-xs text-[var(--color-stone-500)]">
          No approved wardrobe roadmap gaps for this relationship yet.
        </p>
      )}
      <p className="mt-3 text-xs text-[var(--color-stone-500)]">
        Generated {formatDate(brief.generatedAt, "en-US")}.
      </p>
    </Card>
  );
}
