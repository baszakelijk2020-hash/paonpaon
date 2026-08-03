"use client";

import { buttonVariants } from "@paon/ui/components/Button";
import Link from "next/link";
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

const LAPEL_LABELS: Record<string, string> = {
  notch: "notch lapel",
  peak: "peak lapel",
  shawl: "shawl lapel",
  double_breasted: "double-breasted lapel",
};
const POCKETS_LABELS: Record<string, string> = {
  flap: "flap pockets",
  jetted: "jetted pockets",
  patched: "patched pockets",
};
const SHOULDER_LABELS: Record<string, string> = {
  classic: "classic shoulder",
  natural: "natural shoulder",
  roped: "roped shoulder",
  spalla_camicia: "spalla camicia shoulder",
};

function describeSelection(selection: SuitConfigurationSelection): string {
  const preset = selection.modelPreset
    ? ` (matches ${MODEL_NAMES[selection.modelPreset]})`
    : "";
  return `${LAPEL_LABELS[selection.lapel]}, ${POCKETS_LABELS[selection.pockets]}, ${SHOULDER_LABELS[selection.shoulder]}${preset}`;
}

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
          <div className="flex flex-col items-center gap-2">
            <p className="text-center text-sm text-[var(--color-success-500)]">
              Saved. Your advisor can see this pick.
            </p>
            {selection ? (
              <Link
                href={`/messages?prefill=${encodeURIComponent(
                  `I'd like to discuss a made-to-measure suit with ${describeSelection(selection)}.`,
                )}`}
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                Message advisor about this
              </Link>
            ) : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}
