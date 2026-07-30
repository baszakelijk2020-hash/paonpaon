"use server";

import {
  CampaignRepository,
  ProductRepository,
  ProductVariantRepository,
  WardrobeRepository,
} from "@paon/database";
import {
  buildSevenDayCapsule,
  CAMPAIGN_REQUIRED_LOOK_SLOTS,
  completeCampaignChallengeInputSchema,
  enrollCampaignChallengeInputSchema,
  garmentCategoryToOutfitSlot,
  upsertCampaignChallengeLookInputSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function enrollCampaignChallenge(
  formData: FormData,
): Promise<void> {
  await requireSession();
  const parsed = enrollCampaignChallengeInputSchema.parse({
    campaignId: formData.get("campaignId"),
    retailerId: formData.get("retailerId"),
    customerId: formData.get("customerId"),
  });
  await new CampaignRepository(await getSupabaseServerClient()).enrollChallenge(
    parsed,
  );
  revalidatePath("/private-offers");
}

function parseSlotsFromForm(formData: FormData): {
  slotKind: string;
  sourceKind: "owned" | "catalogue_suggested";
  productId?: string;
  wardrobeItemId?: string;
}[] {
  const slots: {
    slotKind: string;
    sourceKind: "owned" | "catalogue_suggested";
    productId?: string;
    wardrobeItemId?: string;
  }[] = [];

  for (const slotKind of CAMPAIGN_REQUIRED_LOOK_SLOTS) {
    const wardrobeId = formData.get(`wardrobe_${slotKind}`);
    const productId = formData.get(`slot_${slotKind}`);
    if (wardrobeId && String(wardrobeId) !== "") {
      slots.push({
        slotKind,
        sourceKind: "owned",
        wardrobeItemId: String(wardrobeId),
      });
      continue;
    }
    if (productId && String(productId) !== "") {
      slots.push({
        slotKind,
        sourceKind: "catalogue_suggested",
        productId: String(productId),
      });
    }
  }

  const accessoriesWardrobe = formData.get("wardrobe_accessories");
  const accessoriesProduct = formData.get("slot_accessories");
  if (accessoriesWardrobe && String(accessoriesWardrobe) !== "") {
    slots.push({
      slotKind: "accessories",
      sourceKind: "owned",
      wardrobeItemId: String(accessoriesWardrobe),
    });
  } else if (accessoriesProduct && String(accessoriesProduct) !== "") {
    slots.push({
      slotKind: "accessories",
      sourceKind: "catalogue_suggested",
      productId: String(accessoriesProduct),
    });
  }

  return slots;
}

export async function saveCampaignChallengeLook(
  formData: FormData,
): Promise<void> {
  await requireSession();
  const parsed = upsertCampaignChallengeLookInputSchema.parse({
    enrollmentId: formData.get("enrollmentId"),
    dayIndex: Number(formData.get("dayIndex")),
    title: formData.get("title"),
    occasionLabel: formData.get("occasionLabel") || undefined,
    slots: parseSlotsFromForm(formData),
  });
  await new CampaignRepository(
    await getSupabaseServerClient(),
  ).upsertChallengeLook(parsed);
  revalidatePath("/private-offers");
}

export async function proposeSevenDayCapsule(
  formData: FormData,
): Promise<void> {
  await requireSession();
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  const customerId = String(formData.get("customerId") ?? "");
  const retailerId = String(formData.get("retailerId") ?? "");

  const supabase = await getSupabaseServerClient();
  const wardrobeRepo = new WardrobeRepository(supabase);
  const campaignRepo = new CampaignRepository(supabase);
  const variantRepo = new ProductVariantRepository(supabase);

  const wardrobeItems = await wardrobeRepo.findByCustomer(customerId as never);
  const products = await campaignRepo.listActiveByRetailer(retailerId);
  const campaign = products.find((entry) => entry.kind === "wardrobe_challenge");
  const targetProducts = campaign
    ? await campaignRepo.listTargetProducts(campaign.id)
    : [];

  const productRepo = new ProductRepository(supabase);
  const catalogueProducts = await productRepo.findByRetailer(retailerId as never);
  const activeIds = new Set(
    targetProducts.length > 0
      ? targetProducts.filter((row) => row.active).map((row) => row.productId)
      : catalogueProducts
          .filter((product) => product.status === "active")
          .map((product) => product.id),
  );

  const catalogueCandidates: {
    productId: string;
    displayName: string;
    slotKind: ReturnType<typeof garmentCategoryToOutfitSlot>;
    inventoryQuantity: number;
    leadTimeDays?: number | null;
  }[] = [];

  for (const product of catalogueProducts) {
    if (!activeIds.has(product.id)) continue;
    const variants = await variantRepo.findByProduct(product.id);
    const bestVariant = variants.sort(
      (left, right) => right.inventoryQuantity - left.inventoryQuantity,
    )[0];
    if (!bestVariant) continue;
    const slotKind = garmentCategoryToOutfitSlot("other");
    const inferredSlot =
      product.name.toLowerCase().includes("jacket")
        ? "jacket"
        : product.name.toLowerCase().includes("trouser")
          ? "trousers"
          : product.name.toLowerCase().includes("shirt")
            ? "shirt"
            : product.name.toLowerCase().includes("shoe")
              ? "shoes"
              : slotKind;
    if (!inferredSlot) continue;
    catalogueCandidates.push({
      productId: product.id,
      displayName: product.name,
      slotKind: inferredSlot,
      inventoryQuantity: bestVariant.inventoryQuantity,
      leadTimeDays: bestVariant.leadTimeDays ?? null,
    });
  }

  const days = buildSevenDayCapsule({
    wardrobeItems: wardrobeItems.map((item) => ({
      wardrobeItemId: item.id,
      displayName: item.displayName,
      categoryCode: item.categoryCode,
      retiredAt: item.retiredAt ?? null,
      deletedAt: item.deletedAt ?? null,
    })),
    catalogueCandidates: catalogueCandidates.filter(
      (candidate): candidate is typeof candidate & { slotKind: NonNullable<typeof candidate.slotKind> } =>
        candidate.slotKind !== null,
    ),
  });

  for (const day of days) {
    await campaignRepo.upsertChallengeLook({
      enrollmentId,
      dayIndex: day.dayIndex,
      title: day.title,
      occasionLabel: day.occasionLabel,
      gapCitations: day.gaps.map((gap) => ({
        slotKind: gap.slotKind,
        explanation: gap.explanation,
        ...(gap.factCitation ? { factCitation: gap.factCitation } : {}),
        ...(gap.ruleCitation ? { ruleCitation: gap.ruleCitation } : {}),
      })),
      slots: day.slots.map((slot) => ({
        slotKind: slot.slotKind,
        sourceKind: slot.sourceKind,
        ...(slot.productId ? { productId: String(slot.productId) } : {}),
        ...(slot.wardrobeItemId
          ? { wardrobeItemId: String(slot.wardrobeItemId) }
          : {}),
      })),
    });
  }

  revalidatePath("/private-offers");
}

export async function completeCampaignChallenge(
  formData: FormData,
): Promise<void> {
  await requireSession();
  const parsed = completeCampaignChallengeInputSchema.parse({
    enrollmentId: formData.get("enrollmentId"),
  });
  await new CampaignRepository(
    await getSupabaseServerClient(),
  ).completeChallenge(parsed.enrollmentId);
  revalidatePath("/private-offers");
}
