"use server";

import { CorporateRepository } from "@paon/database";
import { createCorporateExceptionInputSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireCorporateManagerAppSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface RaiseExceptionFormState {
  formError?: string;
  submitted: boolean;
}

/** A manager raises an exception for a wearer in one of their own account's
 * programmes (PHASE 14.1 / BD-104). Mirrors the wearer-self-service pattern
 * from `employee/actions.ts`'s `raiseServiceRequest`, scoped to a specific
 * wearer instead of self. */
export async function raiseExceptionAsManager(
  _previous: RaiseExceptionFormState,
  formData: FormData,
): Promise<RaiseExceptionFormState> {
  const session = await requireCorporateManagerAppSession();
  const supabase = await getSupabaseServerClient();
  const repo = new CorporateRepository(supabase);

  const manager = await repo.findManagerById(session.managerId);
  if (!manager) {
    return {
      formError: "Your manager record could not be found.",
      submitted: false,
    };
  }

  const kind = String(formData.get("kind") ?? "");
  const wearerId = String(formData.get("wearerId") ?? "");
  const programmeId = String(formData.get("programmeId") ?? "");

  try {
    const values = createCorporateExceptionInputSchema.parse({
      programmeId,
      wearerId: wearerId.length > 0 ? wearerId : undefined,
      kind,
      detail: formData.get("detail"),
    });
    await repo.createException(manager.retailerId, values);
  } catch (error) {
    return {
      formError:
        error instanceof Error ? error.message : "Could not raise exception.",
      submitted: false,
    };
  }

  revalidatePath("/manager");
  return { submitted: true };
}

export interface PublishAnnouncementFormState {
  formError?: string;
  submitted: boolean;
}

/** A manager publishes a draft announcement they authored (PHASE 14.1 /
 * BD-104). Draft creation happens separately in `createAnnouncementAsManager`. */
export async function publishAnnouncementAsManager(
  announcementId: string,
): Promise<PublishAnnouncementFormState> {
  await requireCorporateManagerAppSession();
  try {
    await new CorporateRepository(
      await getSupabaseServerClient(),
    ).publishAnnouncement(announcementId);
  } catch (error) {
    return {
      formError:
        error instanceof Error
          ? error.message
          : "Could not publish announcement.",
      submitted: false,
    };
  }

  revalidatePath("/manager");
  return { submitted: true };
}

export interface CreateAnnouncementFormState {
  formError?: string;
  submitted: boolean;
}

/** A manager writes a draft announcement for their own account's programme
 * (PHASE 14.1 / BD-104). Never published until `publishAnnouncementAsManager`
 * is called. */
export async function createAnnouncementAsManager(
  programmeId: string,
  formData: FormData,
): Promise<CreateAnnouncementFormState> {
  const session = await requireCorporateManagerAppSession();
  const supabase = await getSupabaseServerClient();
  const repo = new CorporateRepository(supabase);

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title || !body) return { submitted: false };

  try {
    // A corporate_manager session carries managerId, never retailerId
    // (that claim only exists for retailer_staff) — the manager's own
    // row is the source of truth for which retailer this announcement
    // belongs to, same as raiseExceptionAsManager above.
    const manager = await repo.findManagerById(session.managerId);
    if (!manager) {
      throw new Error("Your manager record could not be found.");
    }
    await repo.createAnnouncementAsManager(manager.retailerId, {
      programmeId,
      title,
      body,
      authoredByManagerId: session.managerId,
    });
  } catch (error) {
    return {
      formError:
        error instanceof Error
          ? error.message
          : "Could not create announcement.",
      submitted: false,
    };
  }

  revalidatePath("/manager");
  return { submitted: true };
}
