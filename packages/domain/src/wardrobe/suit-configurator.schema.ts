import { z } from "zod";

import {
  SUIT_CONFIGURATION_LAPELS,
  SUIT_CONFIGURATION_POCKETS,
  SUIT_CONFIGURATION_SHOULDERS,
} from "./suit-configurator";

export const saveSuitConfigurationIntentSchema = z.object({
  lapel: z.enum(SUIT_CONFIGURATION_LAPELS),
  pockets: z.enum(SUIT_CONFIGURATION_POCKETS),
  shoulder: z.enum(SUIT_CONFIGURATION_SHOULDERS),
  modelPreset: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
});
