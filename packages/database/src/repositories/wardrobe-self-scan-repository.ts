/**
 * Customer wardrobe self-scan reports and private attachments (PHASE 4.3).
 */

import {
  asId,
  type CustomerId,
  type OrderStatus,
  type RetailerId,
  type SubmitWardrobeSelfScanInput,
  type WardrobeAttachment,
  type WardrobeItemId,
  type WardrobeSelfReport,
  type WardrobeSelfReportId,
  WARDROBE_SELF_REPORT_PROVENANCE,
  type WardrobeFitPerception,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

const WARDROBE_BUCKET = "wardrobe-private";

type SelfReportRow =
  Database["public"]["Tables"]["wardrobe_self_reports"]["Row"];
type AttachmentRow =
  Database["public"]["Tables"]["wardrobe_attachments"]["Row"];

function toSelfReport(row: SelfReportRow): WardrobeSelfReport {
  return {
    id: asId<"WardrobeSelfReportId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    wardrobeItemId: asId<"WardrobeItemId">(row.wardrobe_item_id),
    provenance: WARDROBE_SELF_REPORT_PROVENANCE,
    ...(row.notes ? { notes: row.notes } : {}),
    ...(row.fit_perception
      ? { fitPerception: row.fit_perception as WardrobeFitPerception }
      : {}),
    ...(row.order_line_id
      ? { orderLineId: asId<"OrderLineId">(row.order_line_id) }
      : {}),
    ...(row.physical_garment_id
      ? {
          physicalGarmentId: asId<"PhysicalGarmentId">(row.physical_garment_id),
        }
      : {}),
    reportedAt: row.reported_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAttachment(row: AttachmentRow): WardrobeAttachment {
  return {
    id: asId<"WardrobeAttachmentId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    wardrobeItemId: asId<"WardrobeItemId">(row.wardrobe_item_id),
    ...(row.self_report_id
      ? { selfReportId: asId<"WardrobeSelfReportId">(row.self_report_id) }
      : {}),
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}

export interface WardrobeSelfReportWithUrl {
  readonly report: WardrobeSelfReport;
  readonly attachment?: WardrobeAttachment;
  readonly signedUrl?: string;
}

export class WardrobeSelfScanRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByWardrobeItem(
    wardrobeItemId: WardrobeItemId,
  ): Promise<WardrobeSelfReportWithUrl[]> {
    const { data: reports, error } = await this.client
      .from("wardrobe_self_reports")
      .select("*")
      .eq("wardrobe_item_id", wardrobeItemId)
      .order("reported_at", { ascending: false });
    if (error) throw error;

    return Promise.all(
      reports.map(async (row) => {
        const report = toSelfReport(row);
        const { data: attachments, error: attachmentError } = await this.client
          .from("wardrobe_attachments")
          .select("*")
          .eq("self_report_id", row.id)
          .limit(1);
        if (attachmentError) throw attachmentError;
        const attachmentRow = attachments[0];
        if (!attachmentRow) {
          return { report };
        }
        const attachment = toAttachment(attachmentRow);
        const { data: signed, error: signedError } = await this.client.storage
          .from(attachment.storageBucket)
          .createSignedUrl(attachment.storagePath, 15 * 60);
        if (signedError) throw signedError;
        return { report, attachment, signedUrl: signed.signedUrl };
      }),
    );
  }

  async findRecentByCustomer(
    customerId: CustomerId,
    limit = 10,
  ): Promise<WardrobeSelfReport[]> {
    const { data, error } = await this.client
      .from("wardrobe_self_reports")
      .select("*")
      .eq("customer_id", customerId)
      .order("reported_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(toSelfReport);
  }

  async findOrderStatusForLine(
    orderLineId: string,
  ): Promise<OrderStatus | null> {
    const { data: line, error: lineError } = await this.client
      .from("order_lines")
      .select("order_id")
      .eq("id", orderLineId)
      .maybeSingle();
    if (lineError) throw lineError;
    if (!line?.order_id) return null;

    const { data: order, error: orderError } = await this.client
      .from("orders")
      .select("status")
      .eq("id", line.order_id)
      .maybeSingle();
    if (orderError) throw orderError;
    return order?.status ? (order.status as OrderStatus) : null;
  }

  async submitSelfScan(params: {
    readonly retailerId: RetailerId;
    readonly customerId: CustomerId;
    readonly input: SubmitWardrobeSelfScanInput;
    readonly file?: {
      readonly content: ArrayBuffer;
      readonly fileName: string;
      readonly mimeType: "image/jpeg" | "image/png" | "image/webp";
      readonly sizeBytes: number;
    };
  }): Promise<WardrobeSelfReportId> {
    let storagePath: string | null = null;
    if (params.file) {
      const safeName = params.file.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      storagePath = `${params.retailerId}/${params.customerId}/${params.input.wardrobeItemId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await this.client.storage
        .from(WARDROBE_BUCKET)
        .upload(storagePath, params.file.content, {
          contentType: params.file.mimeType,
          upsert: false,
        });
      if (uploadError) throw uploadError;
    }

    const { data, error } = await this.client.rpc(
      "record_wardrobe_self_report",
      {
        p_wardrobe_item_id: params.input.wardrobeItemId,
        ...(params.input.notes ? { p_notes: params.input.notes } : {}),
        ...(params.input.fitPerception
          ? { p_fit_perception: params.input.fitPerception }
          : {}),
        ...(storagePath ? { p_storage_path: storagePath } : {}),
        ...(params.file?.fileName ? { p_file_name: params.file.fileName } : {}),
        ...(params.file?.mimeType ? { p_mime_type: params.file.mimeType } : {}),
        ...(params.file?.sizeBytes !== undefined
          ? { p_size_bytes: params.file.sizeBytes }
          : {}),
      },
    );
    if (error) {
      if (storagePath) {
        await this.client.storage.from(WARDROBE_BUCKET).remove([storagePath]);
      }
      throw error;
    }
    return asId<"WardrobeSelfReportId">(data as string);
  }
}
