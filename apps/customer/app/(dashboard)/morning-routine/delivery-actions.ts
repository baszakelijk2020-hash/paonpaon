"use server";

import { MorningRoutineDeliveryRepository } from "@paon/database";
import { upsertMorningRoutineSubscriptionInputSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface MorningRoutineDeliveryFormState {
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

function readCheckbox(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

function readChannels(formData: FormData): ("in_app" | "email")[] {
  const channels = formData
    .getAll("channels")
    .filter((value): value is string => typeof value === "string");
  const parsed = channels.filter(
    (channel): channel is "in_app" | "email" =>
      channel === "in_app" || channel === "email",
  );
  return parsed.length > 0 ? parsed : ["in_app"];
}

export async function saveMorningRoutineDeliverySettings(
  _prev: MorningRoutineDeliveryFormState,
  formData: FormData,
): Promise<MorningRoutineDeliveryFormState> {
  await requireSession();

  const quietStartRaw = formData.get("quietStartHour");
  const quietEndRaw = formData.get("quietEndHour");

  const parsed = upsertMorningRoutineSubscriptionInputSchema.safeParse({
    retailerId: formData.get("retailerId"),
    customerId: formData.get("customerId"),
    deliveryOptIn: readCheckbox(formData, "deliveryOptIn"),
    frequency: formData.get("frequency") ?? "daily",
    channels: readChannels(formData),
    timezone: formData.get("timezone") ?? "UTC",
    deliveryHourLocal: Number(formData.get("deliveryHourLocal") ?? 7),
    quietStartHour:
      typeof quietStartRaw === "string" && quietStartRaw.length > 0
        ? Number(quietStartRaw)
        : null,
    quietEndHour:
      typeof quietEndRaw === "string" && quietEndRaw.length > 0
        ? Number(quietEndRaw)
        : null,
    weeklyAnchorDow: Number(formData.get("weeklyAnchorDow") ?? 1),
  });

  if (!parsed.success) {
    return { fieldErrors: zodFieldErrors(parsed.error) };
  }

  try {
    const supabase = await getSupabaseServerClient();
    await new MorningRoutineDeliveryRepository(supabase).upsertSubscription(
      parsed.data,
    );
    revalidatePath("/morning-routine");
    return { fieldErrors: {}, success: true };
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error
          ? error.message
          : "Could not save delivery settings.",
    };
  }
}

export async function unsubscribeMorningRoutineByToken(
  token: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await getSupabaseServerClient();
    await new MorningRoutineDeliveryRepository(supabase).unsubscribeByToken(
      token,
    );
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not unsubscribe.",
    };
  }
}
