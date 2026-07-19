"use server";

import { requireAlterationsPermission } from "@paon/auth";
import { AlterationRepository } from "@paon/database";
import { createAlterationInputSchema } from "@paon/domain";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface CreateAlterationFormState {
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formError?: string;
}

export async function createAlteration(
  _prevState: CreateAlterationFormState,
  formData: FormData,
): Promise<CreateAlterationFormState> {
  const session = await requireSession();
  requireAlterationsPermission(session.retailerRole, "intake");
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const futureNote = raw["futureOrderNote"]?.trim();

  const parsed = createAlterationInputSchema.safeParse({
    customerId: raw["customerId"],
    appointmentId: raw["appointmentId"] || undefined,
    sourceKind: raw["sourceKind"],
    categoryCode: raw["categoryCode"],
    garmentType: raw["garmentType"],
    brand: raw["brand"] || undefined,
    description: raw["description"],
    identifyingPhotoUrl: raw["identifyingPhotoUrl"] || undefined,
    labelMetadata: raw["labelText"] ? { label: raw["labelText"] } : {},
    intakeCondition: raw["intakeCondition"],
    externalReference: raw["externalReference"] || undefined,
    orderLineId: raw["orderLineId"] || undefined,
    supplierOrderReference: raw["supplierOrderReference"] || undefined,
    dueDate: raw["dueDate"] || undefined,
    observations: [
      {
        area: raw["observationArea"],
        observation: raw["observation"],
        classification: "work_now",
      },
      ...(futureNote
        ? [
            {
              area: "Future order",
              observation: futureNote,
              classification: "future_order_note" as const,
            },
          ]
        : []),
    ],
    tasks: [
      {
        operationId: raw["operationId"] || undefined,
        title: raw["taskTitle"],
        instructions: raw["taskInstructions"] || undefined,
        classification: "work_now",
      },
      ...(futureNote
        ? [
            {
              title: "Future order note",
              instructions: futureNote,
              classification: "future_order_note" as const,
            },
          ]
        : []),
    ],
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".")] ??= issue.message;
    }
    return { values: raw, fieldErrors };
  }

  let alterationId: string;
  try {
    const supabase = await getSupabaseServerClient();
    alterationId = await new AlterationRepository(supabase).createIntake(
      parsed.data,
    );
  } catch (error) {
    return {
      values: raw,
      fieldErrors: {},
      formError:
        error instanceof Error ? error.message : "Unable to create work order.",
    };
  }
  redirect(`/alterations/${alterationId}`);
}
