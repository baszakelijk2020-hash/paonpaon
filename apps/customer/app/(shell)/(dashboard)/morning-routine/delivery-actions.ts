"use server";

import {
  CustomerRepository,
  MorningRoutineDeliveryRepository,
} from "@paon/database";
import { upsertMorningRoutineSubscriptionInputSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface DeliverySubscriptionState {
  fieldErrors: Record<string, string>;
  formError?: string;
  success?: boolean;
}

function zodFieldErrors(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

function optionalNumber(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function saveMorningRoutineSubscription(
  _prevState: DeliverySubscriptionState,
  formData: FormData,
): Promise<DeliverySubscriptionState> {
  const session = await requireSession();
  const channelsRaw = formData.getAll("channels").map(String);
  const parsed = upsertMorningRoutineSubscriptionInputSchema.safeParse({
    retailerId: formData.get("retailerId"),
    customerId: formData.get("customerId"),
    optedIn: formData.get("optedIn") === "true",
    frequency: formData.get("frequency") || "daily",
    timezone: formData.get("timezone") || "UTC",
    preferredLocalHour: optionalNumber(formData.get("preferredLocalHour")) ?? 7,
    channels: channelsRaw.length > 0 ? channelsRaw : ["in_app"],
    quietStartMinute: optionalNumber(formData.get("quietStartMinute")),
    quietEndMinute: optionalNumber(formData.get("quietEndMinute")),
  });
  if (!parsed.success) {
    return { fieldErrors: zodFieldErrors(parsed.error) };
  }

  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId as never,
  );
  const customer = customers.find(
    (candidate) =>
      candidate.id === parsed.data.customerId &&
      candidate.retailerId === parsed.data.retailerId,
  );
  if (!customer) {
    return { fieldErrors: {}, formError: "Not authorized for this house." };
  }

  try {
    await new MorningRoutineDeliveryRepository(supabase).upsertSubscription(
      parsed.data,
    );
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error
          ? error.message
          : "Could not save delivery preferences.",
    };
  }

  revalidatePath("/morning-routine");
  return { fieldErrors: {}, success: true };
}
