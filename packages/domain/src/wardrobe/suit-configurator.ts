import type {
  CustomerId,
  RetailerId,
  SuitConfigurationIntentId,
} from "../shared/branded-id";

/** FT-07 Lapel/pocket/shoulder configurator (docs/FOUNDER_TOOL_BLUEPRINTS.md)
 * — pag1.html's `#suit-configurator-widget`. Indices match the source's
 * `data-panel-index` order for each carousel. */
export const SUIT_CONFIGURATION_LAPELS = [
  "notch",
  "peak",
  "shawl",
  "double_breasted",
] as const;
export type SuitConfigurationLapel = (typeof SUIT_CONFIGURATION_LAPELS)[number];

export const SUIT_CONFIGURATION_POCKETS = [
  "flap",
  "jetted",
  "patched",
] as const;
export type SuitConfigurationPockets =
  (typeof SUIT_CONFIGURATION_POCKETS)[number];

export const SUIT_CONFIGURATION_SHOULDERS = [
  "classic",
  "natural",
  "roped",
  "spalla_camicia",
] as const;
export type SuitConfigurationShoulder =
  (typeof SUIT_CONFIGURATION_SHOULDERS)[number];

/** The source's three predefined coherent combinations (`modelConfigs` in
 * pag1.html): 1 = Henk (notch/jetted/natural), 2 = Willem (peak/flap/roped),
 * 3 = Karel (double-breasted/patched/spalla camicia). */
export type SuitConfigurationModelPreset = 1 | 2 | 3;

export const SUIT_CONFIGURATION_MODEL_PRESETS: Record<
  SuitConfigurationModelPreset,
  {
    lapel: SuitConfigurationLapel;
    pockets: SuitConfigurationPockets;
    shoulder: SuitConfigurationShoulder;
  }
> = {
  1: { lapel: "notch", pockets: "jetted", shoulder: "natural" },
  2: { lapel: "peak", pockets: "flap", shoulder: "roped" },
  3: {
    lapel: "double_breasted",
    pockets: "patched",
    shoulder: "spalla_camicia",
  },
};

export interface SuitConfigurationIntent {
  readonly id: SuitConfigurationIntentId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly lapel: SuitConfigurationLapel;
  readonly pockets: SuitConfigurationPockets;
  readonly shoulder: SuitConfigurationShoulder;
  readonly modelPreset?: SuitConfigurationModelPreset;
  readonly createdAt: string;
}
