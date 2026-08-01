"use server";

import {
  CustomerFactRepository,
  RetailerStaffRepository,
} from "@paon/database";
import {
  asId,
  factsFromAdvisorRectangles,
  type AdvisorRectangleKind,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function recordAdvisorRectangleFacts(args: {
  readonly customerId: string;
  readonly selections: readonly {
    readonly conceptId: string;
    readonly kind: AdvisorRectangleKind;
    readonly label: string;
    readonly polarity: "positive" | "negative";
  }[];
  readonly freeformNote?: string;
}): Promise<
  { readonly ok: true } | { readonly ok: false; readonly error: string }
> {
  const session = await requireModuleSession("relationship_intelligence");
  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!staff) {
    return { ok: false, error: "Staff identity required" };
  }

  const observedAt = new Date().toISOString();
  const validation = factsFromAdvisorRectangles({
    retailerId: session.retailerId,
    customerId: asId<"CustomerId">(args.customerId),
    authorStaffId: staff.id,
    observedAt,
    selections: args.selections.map((selection) => ({
      conceptId: asId<"MetadataConceptId">(selection.conceptId),
      kind: selection.kind,
      label: selection.label,
      polarity: selection.polarity,
    })),
    ...(args.freeformNote ? { freeformNote: args.freeformNote } : {}),
  });

  if (!validation.ok) {
    return {
      ok: false,
      error: validation.errors.join(", ") || "Invalid rectangle selections",
    };
  }

  try {
    await new CustomerFactRepository(supabase).recordAdvisorRectangles({
      retailerId: session.retailerId,
      customerId: asId<"CustomerId">(args.customerId),
      staffId: staff.id,
      observedAt,
      selections: args.selections,
      ...(args.freeformNote ? { freeformNote: args.freeformNote } : {}),
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not record rectangles",
    };
  }

  revalidatePath(`/customers/${args.customerId}`);
  return { ok: true };
}
