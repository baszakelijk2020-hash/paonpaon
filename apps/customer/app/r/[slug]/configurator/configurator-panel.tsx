"use client";

import { buttonVariants } from "@paon/ui/components/Button";
import { useActionState, useState } from "react";

import {
  saveSuitConfiguration,
  type SaveSuitConfigurationState,
} from "./actions";
import {
  SuitConfiguratorWidget,
  type SuitConfigurationSelection,
} from "./suit-configurator-widget";

const initial: SaveSuitConfigurationState = {};

const MODEL_NAMES: Record<number, string> = {
  1: "Henk",
  2: "Willem",
  3: "Karel",
};

export function ConfiguratorPanel({
  slug,
  retailerId,
}: {
  slug: string;
  retailerId: string;
}) {
  const [selection, setSelection] = useState<SuitConfigurationSelection | null>(
    null,
  );
  const boundAction = saveSuitConfiguration.bind(null, slug, retailerId);
  const [state, formAction, isPending] = useActionState(boundAction, initial);

  return (
    <div className="flex flex-col items-center gap-4">
      <SuitConfiguratorWidget onSelectionChange={setSelection} />
      <form
        action={formAction}
        className="flex w-full max-w-[390px] flex-col gap-2"
      >
        <input type="hidden" name="lapel" value={selection?.lapel ?? ""} />
        <input type="hidden" name="pockets" value={selection?.pockets ?? ""} />
        <input
          type="hidden"
          name="shoulder"
          value={selection?.shoulder ?? ""}
        />
        <input
          type="hidden"
          name="modelPreset"
          value={selection?.modelPreset ?? ""}
        />
        <p className="text-center text-sm text-[var(--color-stone-600)]">
          {selection?.modelPreset
            ? `Matches ${MODEL_NAMES[selection.modelPreset]}`
            : "Custom combination"}
        </p>
        <button
          type="submit"
          disabled={!selection || isPending}
          className={buttonVariants({ size: "sm" })}
        >
          Save this configuration
        </button>
        {state.formError ? (
          <p
            role="alert"
            className="text-center text-sm text-[var(--color-danger-500)]"
          >
            {state.formError}
          </p>
        ) : null}
        {state.success ? (
          <p className="text-center text-sm text-[var(--color-success-500)]">
            Saved. Your advisor can see this pick.
          </p>
        ) : null}
      </form>
    </div>
  );
}
