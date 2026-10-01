"use server";

import {
  CustomerConsentRepository,
  CustomerPreferencesRepository,
  CustomerRepository,
} from "@paon/database";
import {
  asId,
  setCustomerConsentInputSchema,
  upsertCustomerPreferencesInputSchema,
  type ConsentPurpose,
  type ConsentStatus,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface PreferencesFormState {
  values: Record<string, string | string[]>;
  fieldErrors: Record<string, string>;
  formError?: string;
  success?: boolean;
}

const retailerIdSchema = z.string().uuid();

function consentStatusForToggle(
  purpose: ConsentPurpose,
  enabled: boolean,
  current: ConsentStatus,
): ConsentStatus {
  if (enabled) return "granted";
  // Only mark personalization as withdrawn when turning off an active grant
  // so anonymization runs; never-granted stays denied.
  if (purpose === "personalization" && current === "granted") {
    return "withdrawn";
  }
  if (purpose === "personalization" && current === "withdrawn") {
    return "withdrawn";
  }
  return "denied";
}

export async function savePreferences(
  _prevState: PreferencesFormState,
  formData: FormData,
): Promise<PreferencesFormState> {
  const session = await requireSession();

  const rawRetailerId = formData.get("retailerId");
  const rawPreferredLocale = formData.get("preferredLocale");
  const rawPreferredCurrency = formData.get("preferredCurrency");
  const rawCommunicationChannels = formData.getAll("communicationChannels");
  const rawStyleNotes = formData.get("styleNotes");
  const marketingOptIn = formData.get("marketingOptIn") === "on";
  const personalizationOptIn = formData.get("personalizationOptIn") === "on";
  const locationOptIn = formData.get("locationOptIn") === "on";

  const values: Record<string, string | string[]> = {
    retailerId: typeof rawRetailerId === "string" ? rawRetailerId : "",
    preferredLocale:
      typeof rawPreferredLocale === "string" ? rawPreferredLocale : "",
    preferredCurrency:
      typeof rawPreferredCurrency === "string" ? rawPreferredCurrency : "",
    communicationChannels: rawCommunicationChannels.filter(
      (value): value is string => typeof value === "string",
    ),
    styleNotes: typeof rawStyleNotes === "string" ? rawStyleNotes : "",
    marketingOptIn: marketingOptIn ? "on" : "",
    personalizationOptIn: personalizationOptIn ? "on" : "",
    locationOptIn: locationOptIn ? "on" : "",
  };

  const retailerId = retailerIdSchema.safeParse(rawRetailerId);
  const parsed = upsertCustomerPreferencesInputSchema.safeParse({
    preferredLocale: rawPreferredLocale,
    preferredCurrency: rawPreferredCurrency,
    communicationChannels: rawCommunicationChannels,
    styleNotes: rawStyleNotes || undefined,
    marketingOptIn,
    personalizationOptIn,
    locationOptIn,
  });

  if (!retailerId.success || !parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.success ? [] : parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ??= issue.message;
    }
    if (!retailerId.success) {
      fieldErrors["retailerId"] = "Invalid retailer.";
    }
    return { values, fieldErrors };
  }

  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const customer = customers.find(
    (candidate) => candidate.retailerId === (retailerId.data as never),
  );
  if (!customer) {
    return {
      values,
      fieldErrors: {},
      formError: "No relationship with this retailer.",
    };
  }

  try {
    const consentRepo = new CustomerConsentRepository(supabase);
    const current = await consentRepo.getState(
      customer.retailerId,
      customer.id,
    );
    const consentUpdates: Array<{
      purpose: ConsentPurpose;
      status: ConsentStatus;
    }> = [
      {
        purpose: "personalization",
        status: consentStatusForToggle(
          "personalization",
          parsed.data.personalizationOptIn,
          current.personalization.status,
        ),
      },
      {
        purpose: "marketing",
        status: consentStatusForToggle(
          "marketing",
          parsed.data.marketingOptIn,
          current.marketing.status,
        ),
      },
      {
        purpose: "location",
        status: consentStatusForToggle(
          "location",
          parsed.data.locationOptIn,
          current.location.status,
        ),
      },
    ];

    for (const update of consentUpdates) {
      if (current[update.purpose].status === update.status) continue;
      const consentParsed = setCustomerConsentInputSchema.safeParse(update);
      if (!consentParsed.success) {
        return {
          values,
          fieldErrors: {},
          formError: "Invalid consent update.",
        };
      }
      await consentRepo.setConsent(customer.id, consentParsed.data);
    }

    await new CustomerPreferencesRepository(supabase).upsert(
      customer.id,
      parsed.data,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { values, fieldErrors: {}, formError: message };
  }

  revalidatePath("/account");
  return { values, fieldErrors: {}, success: true };
}

export interface IdentityFormState {
  fieldErrors: Record<string, string>;
  formError?: string;
  success?: boolean;
}

export async function updateProfileDetails(
  _prevState: IdentityFormState,
  formData: FormData,
): Promise<IdentityFormState> {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const retailerId = String(formData.get("retailerId"));
  const fullName = String(formData.get("fullName"));
  const dateOfBirth = formData.get("dateOfBirth");
  const dateOfBirthStr = dateOfBirth ? String(dateOfBirth) : null;
  const profilePhotoUrl = formData.get("profilePhotoUrl");
  const profilePhotoUrlStr = profilePhotoUrl ? String(profilePhotoUrl) : null;

  const parsed = z
    .object({
      retailerId: z.string().uuid(),
      fullName: z.string().min(1, "Full name is required"),
      dateOfBirth: z
        .string()
        .optional()
        .refine(
          (val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val),
          "Invalid date format",
        ),
    })
    .safeParse({
      retailerId,
      fullName,
      dateOfBirth: dateOfBirthStr,
    });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const customer = customers.find((c) => c.retailerId === retailerId);

  if (!customer) {
    return {
      fieldErrors: {},
      formError: "No relationship with this retailer.",
    };
  }

  try {
    await new CustomerRepository(supabase).updateMyProfileDetails(
      asId<"RetailerId">(parsed.data.retailerId),
      {
        fullName: parsed.data.fullName,
        dateOfBirth: parsed.data.dateOfBirth ?? null,
        // The identity form has no photo field: keep the stored photo
        // rather than clearing it on every save.
        profilePhotoUrl: formData.has("profilePhotoUrl")
          ? profilePhotoUrlStr
          : (customer.profilePhotoUrl ?? null),
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { fieldErrors: {}, formError: message };
  }

  revalidatePath("/account");
  return { fieldErrors: {}, success: true };
}

export interface AddressFormState {
  fieldErrors: Record<string, string>;
  formError?: string;
  success?: boolean;
}

export async function saveAddress(
  label: "home" | "work",
  _prevState: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const retailerId = String(formData.get("retailerId"));
  const line1 = String(formData.get("line1"));
  const postalCode = String(formData.get("postalCode"));
  const city = String(formData.get("city"));
  const floor = formData.get("floor");
  const floorStr = floor ? String(floor) : undefined;
  const deliveryNotes = formData.get("deliveryNotes");
  const deliveryNotesStr = deliveryNotes ? String(deliveryNotes) : undefined;
  const countryCode = String(formData.get("countryCode") || "NL");

  const parsed = z
    .object({
      retailerId: z.string().uuid(),
      line1: z.string().min(1, "Street address is required"),
      postalCode: z.string().min(1, "Postal code is required"),
      city: z.string().min(1, "City is required"),
      floor: z.string().optional(),
      deliveryNotes: z.string().optional(),
      countryCode: z.string(),
    })
    .safeParse({
      retailerId,
      line1,
      postalCode,
      city,
      floor: floorStr,
      deliveryNotes: deliveryNotesStr,
      countryCode,
    });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const customer = customers.find((c) => c.retailerId === retailerId);

  if (!customer) {
    return {
      fieldErrors: {},
      formError: "No relationship with this retailer.",
    };
  }

  try {
    await new CustomerRepository(supabase).upsertMyLabeledAddress(
      asId<"RetailerId">(parsed.data.retailerId),
      label,
      {
        line1: parsed.data.line1,
        postalCode: parsed.data.postalCode,
        city: parsed.data.city,
        countryCode: parsed.data.countryCode,
        ...(parsed.data.floor && { floor: parsed.data.floor }),
        ...(parsed.data.deliveryNotes && {
          deliveryNotes: parsed.data.deliveryNotes,
        }),
      } as never,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { fieldErrors: {}, formError: message };
  }

  revalidatePath("/account");
  // The overview's commute reads the work address.
  revalidatePath("/dashboard");
  return { fieldErrors: {}, success: true };
}

export interface UploadProfilePhotoState {
  error?: string;
  photoUrl?: string;
}

const PROFILE_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
type ProfilePhotoMimeType = (typeof PROFILE_PHOTO_MIME_TYPES)[number];
const MAX_PROFILE_PHOTO_BYTES = 10 * 1024 * 1024;
const PROFILE_PHOTOS_BUCKET = "customer-profile-photos";

export async function uploadProfilePhoto(
  _prevState: UploadProfilePhotoState,
  formData: FormData,
): Promise<UploadProfilePhotoState> {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const retailerId = String(formData.get("retailerId"));
  const file = formData.get("photo");

  const retailerIdParsed = retailerIdSchema.safeParse(retailerId);
  if (!retailerIdParsed.success) {
    return { error: "Invalid retailer." };
  }

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a photo first." };
  }

  if (file.size > MAX_PROFILE_PHOTO_BYTES) {
    return { error: "Photo must be 10 MB or smaller." };
  }

  if (!PROFILE_PHOTO_MIME_TYPES.includes(file.type as ProfilePhotoMimeType)) {
    return { error: "Use a JPEG, PNG or WEBP photo." };
  }

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const customer = customers.find(
    (c) => c.retailerId === (retailerIdParsed.data as never),
  );

  if (!customer) {
    return { error: "No relationship with this retailer." };
  }

  try {
    const content = await file.arrayBuffer();
    const mimeType = file.type as ProfilePhotoMimeType;
    const fileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_").slice(-255);
    const storagePath = `${customer.retailerId}/${customer.id}/${crypto.randomUUID()}-${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(PROFILE_PHOTOS_BUCKET)
      .upload(storagePath, content, { contentType: mimeType, upsert: false });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from(PROFILE_PHOTOS_BUCKET)
      .getPublicUrl(storagePath);

    return { photoUrl: urlData?.publicUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { error: message };
  }
}

export interface OneClickCheckoutState {
  error?: string;
  success?: boolean;
}

export async function requestOneClickCheckoutEligibility(
  _prevState: OneClickCheckoutState,
  formData: FormData,
): Promise<OneClickCheckoutState> {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const retailerId = String(formData.get("retailerId"));
  const retailerIdParsed = retailerIdSchema.safeParse(retailerId);

  if (!retailerIdParsed.success) {
    return { error: "Invalid retailer." };
  }

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const customer = customers.find(
    (c) => c.retailerId === (retailerIdParsed.data as never),
  );

  if (!customer) {
    return { error: "No relationship with this retailer." };
  }

  try {
    await new CustomerRepository(supabase).requestMyOneClickCheckoutEligibility(
      asId<"RetailerId">(retailerIdParsed.data),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { error: message };
  }

  revalidatePath("/account");
  return { success: true };
}
