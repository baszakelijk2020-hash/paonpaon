import { z } from "zod";

import { NOTE_VISIBILITY_OPTIONS } from "./clienteling";

export const createClientelingNoteSchema = z.object({
  customerId: z.string().uuid(),
  body: z.string().trim().min(1).max(5000),
  pinned: z.boolean(),
  // ADR-074: narrow by default. A form that offers the author an explicit
  // choice passes it through; one that doesn't (e.g. a quick one-line log)
  // still lands on the product's own narrow default instead of failing.
  visibility: z
    .enum(NOTE_VISIBILITY_OPTIONS as [string, ...string[]])
    .default("assigned_advisor"),
});
