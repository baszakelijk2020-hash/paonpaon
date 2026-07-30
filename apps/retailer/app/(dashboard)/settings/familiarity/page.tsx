import { requireRetailerRole } from "@paon/auth";
import {
  FamiliarityPresetRepository,
  SourceAuthorityRepository,
} from "@paon/database";
import {
  FAMILIARITY_PRESET_CONFIGS,
  suggestFamiliarityPresetForProvider,
} from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FamiliarityPresetForm } from "./familiarity-preset-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function FamiliaritySettingsPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "admin");
  } catch {
    redirect("/dashboard");
  }

  const supabase = await getSupabaseServerClient();
  const [preset, connections] = await Promise.all([
    new FamiliarityPresetRepository(supabase).findByRetailer(
      session.retailerId,
    ),
    new SourceAuthorityRepository(supabase).listConnections(session.retailerId),
  ]);

  const suggested =
    connections
      .map((connection) =>
        suggestFamiliarityPresetForProvider(connection.provider),
      )
      .find((value) => value !== null) ?? null;

  const activeConfig = FAMILIARITY_PRESET_CONFIGS[preset.presetKey];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/settings"
          className="text-sm text-[var(--color-stone-500)] underline"
        >
          ← Settings
        </Link>
        <h1 className="font-display mt-2 text-2xl text-[var(--color-stone-900)]">
          Familiarity preset
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Source-specific labels, grouping, and defaults only. Permissions,
          workflow states, and tenant data remain canonical.
        </p>
      </div>

      <FamiliarityPresetForm
        currentPresetKey={preset.presetKey}
        suggestedPresetKey={suggested}
      />

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Active label aliases
        </h2>
        {Object.keys(activeConfig.labelAliases).length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            PAON recommended uses canonical labels everywhere.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {Object.entries(activeConfig.labelAliases).map(([key, label]) => (
              <li
                key={key}
                className="flex flex-wrap justify-between gap-2 border-b border-[var(--color-stone-100)] py-2"
              >
                <span className="text-[var(--color-stone-500)]">{key}</span>
                <span>{label}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
