import { KnowledgeRepository } from "@paon/database";
import type { KnowledgeTopic, KnowledgeObject } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const TOPIC_LABELS: Record<KnowledgeTopic, string> = {
  mill: "Mills",
  fibre: "Fibres",
  fabric: "Fabrics",
  weave: "Weaves",
  construction: "Construction",
  collar: "Collars",
  styling: "Styling",
  care: "Care",
  performance: "Performance",
  occasion: "Occasions",
  value: "Value",
  tradeoff: "Tradeoffs",
};

export default async function KnowledgeLibraryPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const knowledgeRepo = new KnowledgeRepository(supabase);
  const allObjects = await knowledgeRepo.findVisible(session.retailerId);

  // Group by topic
  const groupedByTopic = new Map<KnowledgeTopic, KnowledgeObject[]>();
  for (const obj of allObjects) {
    const current = groupedByTopic.get(obj.topic) ?? [];
    current.push(obj);
    groupedByTopic.set(obj.topic, current);
  }

  // Sort topics by their order in TOPIC_LABELS
  const topicsInOrder: KnowledgeTopic[] = [
    "mill",
    "fibre",
    "fabric",
    "weave",
    "construction",
    "collar",
    "styling",
    "care",
    "performance",
    "occasion",
    "value",
    "tradeoff",
  ];

  const topicsWithContent = topicsInOrder.filter((topic) =>
    groupedByTopic.has(topic),
  );

  return (
    <div className="flex flex-col gap-6">
      <Heading />

      {topicsWithContent.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-stone-500)]">
            No knowledge objects available yet.
          </p>
        </Card>
      ) : (
        topicsWithContent.map((topic) => {
          const objects = groupedByTopic.get(topic)!;
          return (
            <div key={topic}>
              <h2 className="font-display mb-3 text-lg text-[var(--color-stone-900)]">
                {TOPIC_LABELS[topic]}
              </h2>
              <div className="flex flex-col gap-3">
                {objects.map((obj) => (
                  <Card key={obj.id}>
                    <div className="flex flex-col gap-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-stone-900)]">
                          {obj.title}
                        </p>
                        <p className="mt-1 text-sm text-[var(--color-stone-700)]">
                          {obj.summary}
                        </p>
                      </div>
                      {obj.body ? (
                        <details className="group">
                          <summary className="cursor-pointer select-none text-xs font-medium text-[var(--color-stone-500)] hover:text-[var(--color-stone-700)]">
                            Read more
                          </summary>
                          <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--color-stone-700)]">
                            {obj.body}
                          </p>
                        </details>
                      ) : null}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function Heading() {
  return (
    <div>
      <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
        Knowledge library
      </h1>
      <p className="text-sm text-[var(--color-stone-500)]">
        Sartorial trivia, mills, fabrics — read and learn
      </p>
    </div>
  );
}
