import { requireRetailerRole } from "@paon/auth";
import { WorkflowDefinitionRepository } from "@paon/database";
import {
  ALTERATION_STATUS_LABELS,
  applyTerminologyLabels,
  FAMILIARITY_PRESET_CATALOG,
  FAMILIARITY_PRESET_KEYS,
  evaluateWorkflowTransition,
  type FamiliarityPresetKey,
} from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";
import { redirect } from "next/navigation";

import { setFamiliarityPresetAction } from "./actions";

import { requireSession } from "@/lib/session";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Versioned workflow + familiarity preset operator surface (PHASE 8.3).
 * Presets change labels/grouping/defaults only — not schema or transitions.
 */
export default async function WorkflowsSettingsPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "admin");
  } catch {
    redirect("/dashboard");
  }

  const supabase = await getSupabaseServerClient();
  const admin = getSupabaseAdminClient();
  const adminRepo = new WorkflowDefinitionRepository(admin);
  const userRepo = new WorkflowDefinitionRepository(supabase);

  const activeVersion = await adminRepo.ensureAlterationWorkflowV1();
  const preset = await userRepo.getRetailerPreset(session.retailerId);
  const remapped = applyTerminologyLabels(
    ALTERATION_STATUS_LABELS,
    preset.terminology,
  );

  const sampleDenied = evaluateWorkflowTransition({
    snapshot: activeVersion.snapshot,
    from: "intake",
    to: "completed",
    role: "manager",
  });
  const sampleOk = evaluateWorkflowTransition({
    snapshot: activeVersion.snapshot,
    from: "intake",
    to: "quoted",
    role: "manager",
    fieldValues: { quotedAmount: 100 },
  });

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
          Workflows & familiarity
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Active garment workflow version is pinned on instances. Familiarity
          presets change labels and navigation wording only.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Alteration work order · v{activeVersion.versionNumber}
        </h2>
        <p className="mt-2 text-sm text-[var(--color-stone-600)]">
          {activeVersion.snapshot.versionLabel} ·{" "}
          {activeVersion.snapshot.states.length} states ·{" "}
          {activeVersion.snapshot.transitions.length} transitions
        </p>
        <ul className="mt-3 flex flex-col gap-1 text-sm text-[var(--color-stone-700)]">
          <li>
            Invalid transition check:{" "}
            {sampleDenied.ok ? "unexpectedly allowed" : sampleDenied.code}
          </li>
          <li>
            Manager intake→quoted with quote:{" "}
            {sampleOk.ok ? "allowed" : sampleOk.code}
          </li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Familiarity preset
        </h2>
        <p className="mt-1 text-sm text-[var(--color-stone-500)]">
          Active: {preset.displayName} ({preset.key})
        </p>
        <form
          action={setFamiliarityPresetAction}
          className="mt-4 flex flex-col gap-3"
        >
          <label className="text-sm text-[var(--color-stone-700)]">
            Choose preset
            <select
              name="presetKey"
              defaultValue={preset.key}
              className="mt-1 block w-full border border-[var(--color-stone-200)] bg-white px-3 py-2 text-sm"
            >
              {FAMILIARITY_PRESET_KEYS.map((key) => (
                <option key={key} value={key}>
                  {
                    FAMILIARITY_PRESET_CATALOG[key as FamiliarityPresetKey]
                      .displayName
                  }
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="self-start bg-[var(--color-stone-900)] px-4 py-2 text-sm text-white"
          >
            Save preset
          </button>
        </form>
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Label preview (same semantic keys)
        </h2>
        <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          {(
            Object.keys(ALTERATION_STATUS_LABELS) as Array<
              keyof typeof ALTERATION_STATUS_LABELS
            >
          ).map((key) => (
            <li
              key={key}
              className="flex justify-between gap-2 border-b border-[var(--color-stone-100)] py-1"
            >
              <span className="text-[var(--color-stone-500)]">{key}</span>
              <span>{remapped[key]}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-[var(--color-stone-500)]">
          Nav preview:{" "}
          {preset.navigation.labelsByHref["/alterations"] ?? "Alterations"} ·{" "}
          {preset.navigation.groupLabels.fitting_room ?? "Fitting room"}
        </p>
      </Card>
    </div>
  );
}
