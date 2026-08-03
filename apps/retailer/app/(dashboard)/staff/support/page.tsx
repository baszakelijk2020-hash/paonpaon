import { InternalCommunityRepository } from "@paon/database";
import { Card } from "@paon/ui/components/Card";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function SupportResourcesPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const resources = await new InternalCommunityRepository(
    supabase,
  ).listSupportResources({ retailerId: session.retailerId });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Support
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Confidential help resources. Looking at this page is not recorded
          anywhere — reach out in whatever way feels right.
        </p>
      </div>

      <Card>
        {resources.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            Nothing in the catalogue yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {resources.map((resource) => (
              <li
                key={resource.id}
                data-resource-key={resource.resource_key}
                className="border-b border-[var(--color-stone-100)] pb-4 last:border-0"
              >
                <p className="text-sm font-medium text-[var(--color-stone-900)]">
                  {resource.title}
                </p>
                <p className="mt-1 text-sm text-[var(--color-stone-700)]">
                  {resource.summary}
                </p>
                <p className="mt-2 flex flex-wrap gap-3 text-sm">
                  {resource.external_url ? (
                    <a
                      href={resource.external_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--color-stone-900)] underline"
                    >
                      Visit
                    </a>
                  ) : null}
                  {resource.phone ? (
                    <a
                      href={`tel:${resource.phone}`}
                      className="text-[var(--color-stone-900)] underline"
                    >
                      {resource.phone}
                    </a>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
