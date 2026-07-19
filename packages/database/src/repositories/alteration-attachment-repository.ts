import {
  asId,
  type AlterationAttachment,
  type AlterationId,
  type AlterationTaskId,
  type RetailerId,
  type StaffId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

const EVIDENCE_BUCKET = "alteration-evidence";

type AttachmentRow =
  Database["public"]["Tables"]["alteration_attachments"]["Row"];

function toDomain(row: AttachmentRow): AlterationAttachment {
  return {
    id: asId<"AlterationAttachmentId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    ...(row.alteration_id
      ? { alterationId: asId<"AlterationId">(row.alteration_id) }
      : {}),
    ...(row.task_id ? { taskId: asId<"AlterationTaskId">(row.task_id) } : {}),
    ...(row.observation_id
      ? { observationId: asId<"FittingObservationId">(row.observation_id) }
      : {}),
    ...(row.proposal_id
      ? { proposalId: asId<"PriceChangeProposalId">(row.proposal_id) }
      : {}),
    ...(row.physical_garment_id
      ? {
          physicalGarmentId: asId<"PhysicalGarmentId">(row.physical_garment_id),
        }
      : {}),
    kind: row.kind,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    ...(row.uploaded_by_staff_id
      ? { uploadedByStaffId: asId<"StaffId">(row.uploaded_by_staff_id) }
      : {}),
    createdAt: row.created_at,
  };
}

export interface AlterationAttachmentWithUrl {
  attachment: AlterationAttachment;
  signedUrl: string;
}

export class AlterationAttachmentRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByAlteration(
    alterationId: AlterationId,
  ): Promise<AlterationAttachmentWithUrl[]> {
    const { data, error } = await this.client
      .from("alteration_attachments")
      .select("*")
      .eq("alteration_id", alterationId)
      .order("created_at", { ascending: true });
    if (error) throw error;

    return Promise.all(
      data.map(async (row) => {
        const attachment = toDomain(row);
        const { data: signed, error: signedError } = await this.client.storage
          .from(attachment.storageBucket)
          .createSignedUrl(attachment.storagePath, 15 * 60);
        if (signedError) throw signedError;
        return { attachment, signedUrl: signed.signedUrl };
      }),
    );
  }

  async uploadImage(params: {
    retailerId: RetailerId;
    alterationId: AlterationId;
    taskId?: AlterationTaskId;
    staffId?: StaffId;
    kind: "intake" | "evidence" | "progress" | "completion";
    storagePath: string;
    fileName: string;
    mimeType: "image/jpeg" | "image/png" | "image/webp";
    sizeBytes: number;
    content: ArrayBuffer;
  }): Promise<AlterationAttachment> {
    const { error: uploadError } = await this.client.storage
      .from(EVIDENCE_BUCKET)
      .upload(params.storagePath, params.content, {
        contentType: params.mimeType,
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data, error } = await this.client
      .from("alteration_attachments")
      .insert({
        retailer_id: params.retailerId,
        alteration_id: params.alterationId,
        task_id: params.taskId ?? null,
        kind: params.kind,
        storage_bucket: EVIDENCE_BUCKET,
        storage_path: params.storagePath,
        file_name: params.fileName,
        mime_type: params.mimeType,
        size_bytes: params.sizeBytes,
        uploaded_by_staff_id: params.staffId ?? null,
      })
      .select("*")
      .single();

    if (error) {
      await this.client.storage
        .from(EVIDENCE_BUCKET)
        .remove([params.storagePath]);
      throw error;
    }
    return toDomain(data);
  }
}
