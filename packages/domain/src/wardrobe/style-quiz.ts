import type { MetadataConcept } from "../metadata/metadata";
import type { MetadataConceptId } from "../shared/branded-id";

export interface StyleQuizArchetype {
  readonly conceptId: MetadataConceptId;
  readonly slug: string;
  readonly label: string;
  readonly description: string;
  readonly emoji: string;
  readonly order: number;
}

export interface StyleQuizTweakOption {
  readonly conceptId: MetadataConceptId;
  readonly slug: string;
  readonly label: string;
  readonly order: number;
}

export interface StyleQuizTweakQuestion {
  readonly group: string;
  readonly question: string;
  readonly options: readonly StyleQuizTweakOption[];
}

function readString(
  attributes: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  const value = attributes[key];
  return typeof value === "string" ? value : undefined;
}

function readNumber(
  attributes: Readonly<Record<string, unknown>>,
  key: string,
): number {
  const value = attributes[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Archetype concepts are canonical `style`-kind concepts flagged
 * `attributes.isArchetype`. Picking one is a single tap that declares a
 * positive style preference through the existing
 * `upsert_declared_style_preference` RPC — no new schema, just a curated
 * on-ramp onto it.
 */
export function buildStyleQuizArchetypes(
  concepts: readonly MetadataConcept[],
): StyleQuizArchetype[] {
  return concepts
    .filter((concept) => concept.attributes["isArchetype"] === true)
    .map((concept) => ({
      conceptId: concept.id,
      slug: concept.slug,
      label: concept.canonicalName,
      description: readString(concept.attributes, "description") ?? "",
      emoji: readString(concept.attributes, "emoji") ?? "🧵",
      order: readNumber(concept.attributes, "order"),
    }))
    .sort((a, b) => a.order - b.order);
}

/**
 * Personal-tweak concepts span whichever kind they naturally belong to
 * (fit, pattern, colour, formality, ...) and share
 * `attributes.tweakGroup` / `attributes.question`, which is enough to
 * group them into single-tap questions without a dedicated join table.
 */
export function buildStyleQuizTweakQuestions(
  concepts: readonly MetadataConcept[],
): StyleQuizTweakQuestion[] {
  const groups = new Map<
    string,
    { question: string; order: number; options: StyleQuizTweakOption[] }
  >();

  for (const concept of concepts) {
    const group = readString(concept.attributes, "tweakGroup");
    if (!group) continue;
    const option: StyleQuizTweakOption = {
      conceptId: concept.id,
      slug: concept.slug,
      label: concept.canonicalName,
      order: readNumber(concept.attributes, "order"),
    };
    const existing = groups.get(group);
    if (existing) {
      existing.options.push(option);
      continue;
    }
    groups.set(group, {
      question: readString(concept.attributes, "question") ?? group,
      order: readNumber(concept.attributes, "groupOrder"),
      options: [option],
    });
  }

  return [...groups.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([group, value]) => ({
      group,
      question: value.question,
      options: [...value.options].sort((a, b) => a.order - b.order),
    }));
}

/** Whether the customer has ever completed the archetype step of the quiz. */
export function hasChosenStyleArchetype(
  archetypes: readonly StyleQuizArchetype[],
  declaredConceptIds: ReadonlySet<string>,
): boolean {
  return archetypes.some((archetype) =>
    declaredConceptIds.has(archetype.conceptId),
  );
}
