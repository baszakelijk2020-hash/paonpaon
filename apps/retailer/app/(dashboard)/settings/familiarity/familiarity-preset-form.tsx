"use client";

import {
  FAMILIARITY_PRESET_CONFIGS,
  type FamiliarityPresetKey,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import {
  updateFamiliarityPreset,
  type FamiliarityPresetFormState,
} from "./actions";

const initialState: FamiliarityPresetFormState = {};

export function FamiliarityPresetForm({
  currentPresetKey,
  suggestedPresetKey,
}: {
  currentPresetKey: FamiliarityPresetKey;
  suggestedPresetKey: FamiliarityPresetKey | null;
}) {
  const [state, formAction, isPending] = useActionState(
    updateFamiliarityPreset,
    initialState,
  );

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="presetKey"
            className="mb-1 block text-sm font-medium text-[var(--color-stone-700)]"
          >
            Terminology and navigation preset
          </label>
          <Select
            id="presetKey"
            name="presetKey"
            defaultValue={currentPresetKey}
          >
            {Object.values(FAMILIARITY_PRESET_CONFIGS).map((preset) => (
              <option key={preset.key} value={preset.key}>
                {preset.displayName}
              </option>
            ))}
          </Select>
          <p className="mt-2 text-sm text-[var(--color-stone-500)]">
            {FAMILIARITY_PRESET_CONFIGS[currentPresetKey].description}
          </p>
          {suggestedPresetKey && suggestedPresetKey !== currentPresetKey ? (
            <p className="mt-2 text-sm text-[var(--color-stone-600)]">
              A connected source suggests the{" "}
              {FAMILIARITY_PRESET_CONFIGS[suggestedPresetKey].displayName}{" "}
              preset for easier migration. Data, permissions, and workflows stay
              canonical.
            </p>
          ) : null}
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save preset"}
        </Button>
        {state.formError ? (
          <p role="alert" className="text-sm text-[var(--color-danger-500)]">
            {state.formError}
          </p>
        ) : null}
        {state.saved ? (
          <p className="text-sm text-[var(--color-success-500)]">
            Preset saved.
          </p>
        ) : null}
      </form>
    </Card>
  );
}
