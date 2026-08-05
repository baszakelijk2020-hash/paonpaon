import {
  asId,
  type ConceptOrderSelectionId,
  type ConceptOrderSelectionItem,
  type ConceptScanCode,
  type ConceptScanCodeId,
  type ConceptScanCodeStatus,
  type ConceptScanKind,
  type ConceptScanReveal,
  type CurrencyCode,
  type ProductVariantId,
  type RetailerId,
  type StaffId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type ScanCodeRow = Database["public"]["Tables"]["concept_scan_codes"]["Row"];

const toScanCode = (row: ScanCodeRow): ConceptScanCode => ({
  id: asId<"ConceptScanCodeId">(row.id),
  retailerId: asId<"RetailerId">(row.retailer_id),
  productVariantId: asId<"ProductVariantId">(row.product_variant_id),
  kind: row.kind as ConceptScanKind,
  code: row.code,
  status: row.status as ConceptScanCodeStatus,
  ...(row.expires_at ? { expiresAt: row.expires_at } : {}),
  ...(row.superseded_by_code_id
    ? {
        supersededByCodeId: asId<"ConceptScanCodeId">(
          row.superseded_by_code_id,
        ),
      }
    : {}),
  ...(row.created_by_staff_id
    ? { createdByStaffId: asId<"StaffId">(row.created_by_staff_id) }
    : {}),
  createdAt: row.created_at,
});

interface ResolveConceptScanCodePayload {
  status: ConceptScanReveal["status"];
  code: string | null;
  kind: ConceptScanKind | null;
  retailerId: string | null;
  retailerDisplayName: string | null;
  retailerSlug: string | null;
  productVariantId: string | null;
  productName: string | null;
  variantLabel: string | null;
  priceAmountMinorUnits: number | null;
  priceCurrency: string | null;
  primaryImageUrl: string | null;
}

/** A retailer's submitted concept selection with its items resolved for
 * advisor review — one row per (customer, submitted selection). */
export interface ConceptOrderSelectionForReview {
  readonly id: ConceptOrderSelectionId;
  readonly customerName: string;
  readonly submittedAt: string;
  readonly items: readonly ConceptOrderSelectionItem[];
}

export class ConceptScanRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findCodesByRetailer(
    retailerId: RetailerId,
  ): Promise<ConceptScanCode[]> {
    const { data, error } = await this.client
      .from("concept_scan_codes")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toScanCode);
  }

  async issueCode(
    retailerId: RetailerId,
    staffId: StaffId,
    values: {
      productVariantId: ProductVariantId;
      kind: ConceptScanKind;
      expiresAt?: string;
    },
  ): Promise<ConceptScanCode> {
    const { data, error } = await this.client
      .from("concept_scan_codes")
      .insert({
        retailer_id: retailerId,
        product_variant_id: values.productVariantId,
        kind: values.kind,
        expires_at: values.expiresAt ?? null,
        created_by_staff_id: staffId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toScanCode(data);
  }

  /** Recalls a code and mints a fresh one for the same variant/kind — the
   * blueprint's "rotatable" requirement: the old code stops resolving
   * immediately, a new physical tag can be issued without disturbing the
   * item record itself. */
  async rotateCode(
    id: ConceptScanCodeId,
    staffId: StaffId,
  ): Promise<ConceptScanCode> {
    const { data: existing, error: findError } = await this.client
      .from("concept_scan_codes")
      .select("*")
      .eq("id", id)
      .single();
    if (findError) throw findError;

    const { error: recallError } = await this.client
      .from("concept_scan_codes")
      .update({ status: "recalled" })
      .eq("id", id);
    if (recallError) throw recallError;

    const { data: replacement, error: insertError } = await this.client
      .from("concept_scan_codes")
      .insert({
        retailer_id: existing.retailer_id,
        product_variant_id: existing.product_variant_id,
        kind: existing.kind,
        expires_at: existing.expires_at,
        created_by_staff_id: staffId,
      })
      .select("*")
      .single();
    if (insertError) throw insertError;

    const { error: linkError } = await this.client
      .from("concept_scan_codes")
      .update({ superseded_by_code_id: replacement.id })
      .eq("id", id);
    if (linkError) throw linkError;

    return toScanCode(replacement);
  }

  async recallCode(id: ConceptScanCodeId): Promise<void> {
    const { error } = await this.client
      .from("concept_scan_codes")
      .update({ status: "recalled" })
      .eq("id", id);
    if (error) throw error;
  }

  /** Anonymous, opaque-code resolution (`resolve_concept_scan_code`,
   * SECURITY DEFINER). Returns an "unknown" status rather than throwing
   * for a code with no match, since the reveal page renders that as one
   * of its named states rather than a hard error. */
  async resolveCode(code: string): Promise<ConceptScanReveal> {
    const { data, error } = await this.client.rpc("resolve_concept_scan_code", {
      p_code: code,
    });
    if (error) throw error;
    const payload = data as unknown as ResolveConceptScanCodePayload;
    return {
      status: payload.status,
      ...(payload.code ? { code: payload.code } : {}),
      ...(payload.kind ? { kind: payload.kind } : {}),
      ...(payload.retailerId
        ? { retailerId: asId<"RetailerId">(payload.retailerId) }
        : {}),
      ...(payload.retailerDisplayName
        ? { retailerDisplayName: payload.retailerDisplayName }
        : {}),
      ...(payload.retailerSlug ? { retailerSlug: payload.retailerSlug } : {}),
      ...(payload.productVariantId
        ? {
            productVariantId: asId<"ProductVariantId">(
              payload.productVariantId,
            ),
          }
        : {}),
      ...(payload.productName ? { productName: payload.productName } : {}),
      ...(payload.variantLabel ? { variantLabel: payload.variantLabel } : {}),
      ...(payload.priceAmountMinorUnits != null && payload.priceCurrency
        ? {
            price: {
              amountMinorUnits: payload.priceAmountMinorUnits,
              currency: payload.priceCurrency as CurrencyCode,
            },
          }
        : {}),
      ...(payload.primaryImageUrl
        ? { primaryImageUrl: payload.primaryImageUrl }
        : {}),
    };
  }

  /** Authenticated add-to-selection (`add_concept_scan_selection`,
   * SECURITY DEFINER) — re-derives the caller's own Customer row,
   * finds-or-creates their open draft selection and enforces the code's
   * House boundary server-side. */
  async addToSelection(
    retailerId: RetailerId,
    code: string,
  ): Promise<{ selectionId: ConceptOrderSelectionId; itemCount: number }> {
    const { data, error } = await this.client.rpc(
      "add_concept_scan_selection",
      { p_retailer_id: retailerId, p_code: code },
    );
    if (error) throw error;
    const payload = data as { selectionId: string; itemCount: number };
    return {
      selectionId: asId<"ConceptOrderSelectionId">(payload.selectionId),
      itemCount: payload.itemCount,
    };
  }

  /** The caller's own open draft selection and its items, for the
   * "My concept list" surface. */
  async findDraftSelectionForCustomer(retailerId: RetailerId): Promise<{
    id: ConceptOrderSelectionId;
    items: readonly ConceptOrderSelectionItem[];
  } | null> {
    const { data: selection, error } = await this.client
      .from("concept_order_selections")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("status", "draft")
      .maybeSingle();
    if (error) throw error;
    if (!selection) return null;

    const items = await this.findSelectionItems(
      asId<"ConceptOrderSelectionId">(selection.id),
    );
    return { id: asId<"ConceptOrderSelectionId">(selection.id), items };
  }

  private async findSelectionItems(
    selectionId: ConceptOrderSelectionId,
  ): Promise<ConceptOrderSelectionItem[]> {
    const { data, error } = await this.client
      .from("concept_order_selection_items")
      .select(
        "scan_code_id, added_at, concept_scan_codes(kind, product_variant_id)",
      )
      .eq("selection_id", selectionId)
      .order("added_at", { ascending: true });
    if (error) throw error;

    const rows = data as unknown as {
      scan_code_id: string;
      added_at: string;
      concept_scan_codes: { kind: string; product_variant_id: string } | null;
    }[];

    const variantIds = rows
      .map((row) => row.concept_scan_codes?.product_variant_id)
      .filter((id): id is string => Boolean(id));
    if (variantIds.length === 0) return [];

    const { data: variants, error: variantsError } = await this.client
      .from("product_variants")
      .select("id, size, color, products(name, primary_image_url)")
      .in("id", variantIds);
    if (variantsError) throw variantsError;

    const variantById = new Map(
      (
        variants as unknown as {
          id: string;
          size: string | null;
          color: string | null;
          products: { name: string; primary_image_url: string | null } | null;
        }[]
      ).map((variant) => [variant.id, variant]),
    );

    return rows.map((row) => {
      const variant = row.concept_scan_codes
        ? variantById.get(row.concept_scan_codes.product_variant_id)
        : undefined;
      const variantLabel = variant
        ? [variant.size, variant.color].filter(Boolean).join(" · ")
        : "";
      return {
        scanCodeId: asId<"ConceptScanCodeId">(row.scan_code_id),
        kind: (row.concept_scan_codes?.kind ?? "try_on") as ConceptScanKind,
        productName: variant?.products?.name ?? "Unknown item",
        ...(variantLabel ? { variantLabel } : {}),
        ...(variant?.products?.primary_image_url
          ? { primaryImageUrl: variant.products.primary_image_url }
          : {}),
        addedAt: row.added_at,
      };
    });
  }

  /** Explicit "Send to advisor" decision (`submit_concept_selection`,
   * SECURITY DEFINER). */
  async submitSelection(selectionId: ConceptOrderSelectionId): Promise<void> {
    const { error } = await this.client.rpc("submit_concept_selection", {
      p_selection_id: selectionId,
    });
    if (error) throw error;
  }

  /** Submitted selections across all of a retailer's customers, for the
   * advisor review inbox — read-only in this slice; converting a
   * selection into a real proposal/order happens outside it, matching
   * FT-10's gift-booklet precedent. */
  async findSubmittedSelectionsByRetailer(
    retailerId: RetailerId,
  ): Promise<ConceptOrderSelectionForReview[]> {
    const { data, error } = await this.client
      .from("concept_order_selections")
      .select("id, submitted_at, customers(full_name)")
      .eq("retailer_id", retailerId)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false });
    if (error) throw error;

    const rows = data as unknown as {
      id: string;
      submitted_at: string | null;
      customers: { full_name: string } | null;
    }[];

    return Promise.all(
      rows.map(async (row) => ({
        id: asId<"ConceptOrderSelectionId">(row.id),
        customerName: row.customers?.full_name ?? "Unknown customer",
        submittedAt: row.submitted_at ?? "",
        items: await this.findSelectionItems(
          asId<"ConceptOrderSelectionId">(row.id),
        ),
      })),
    );
  }
}
