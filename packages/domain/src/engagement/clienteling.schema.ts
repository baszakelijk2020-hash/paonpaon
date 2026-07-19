import { z } from "zod";

export const createClientelingNoteSchema = z.object({
  customerId: z.string().uuid(),
  body: z.string().trim().min(1).max(5000),
  pinned: z.boolean(),
});
