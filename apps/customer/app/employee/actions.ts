"use server";

import { CorporateRepository } from "@paon/database";
import {
  createCorporateExceptionInputSchema,
  type CorporateExceptionKind,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { WEARER_RAISABLE_EXCEPTION_KINDS } from "./service-request-kinds";

import { requireWearerAppSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface RaiseServiceRequestFormState {
  formError?: string;
  submitted: boolean;
}

export async function raiseServiceRequest(
  _previous: RaiseServiceRequestFormState,
  formData: FormData,
): Promise<RaiseServiceRequestFormState> {
  const session = await requireWearerAppSession();
  const supabase = await getSupabaseServerClient();
  const repo = new CorporateRepository(supabase);

  const wearer = await repo.findWearerById(session.wearerId);
  if (!wearer) {
    return {
      formError: "Your employee record could not be found.",
      submitted: false,
    };
  }

  const kind = String(formData.get("kind") ?? "");
  if (
    !WEARER_RAISABLE_EXCEPTION_KINDS.includes(kind as CorporateExceptionKind)
  ) {
    return { formError: "Choose what the problem is.", submitted: false };
  }

  const values = createCorporateExceptionInputSchema.parse({
    programmeId: wearer.programmeId,
    wearerId: wearer.id,
    kind,
    detail: formData.get("detail"),
  });
  await repo.createException(wearer.retailerId, values);
  revalidatePath("/employee");
  return { submitted: true };
}
