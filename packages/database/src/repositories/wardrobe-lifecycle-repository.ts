/**
 * Wardrobe lifecycle, self-scan, private attachments, and fit-freshness
 * projection (PHASE 4.3 / ADR-016, 055, 063).
 */

import {
  asId,
  deriveLongevityGuidance,
  isSecureWardrobeEvidencePath,
  isWardrobeItemSelfScanEligible,
  projectFitFreshness,
  projectLifecycleState,
  recommendFitServiceHandoff,
  type AppointmentType,
  type FitFreshnessProjection,
  type LongevityGuidanceItem,
  type LongevityGuidanceKind,
  type RecordWardrobeLifecycleEventInput,
  type RetailerId,
  type SubmitWardrobeSelfScanInput,
  type WardrobeActorKind,
  type WardrobeAttachment,
  type WardrobeAttachmentKind,
  type WardrobeFitPerception,
  type WardrobeItem,
  type WardrobeItemId,
  type WardrobeLifecycleEvent,
  type WardrobeLifecycleEventId,
  type WardrobeLifecycleEventKind,
  type WardrobeLifecycleState,
  type WardrobeSelfScan,
  type WardrobeSelfScanId,
  type WardrobeServiceHandoffKind,
  WARDROBE_SELF_SCAN_PROVENANCE,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

const EVIDENCE_BUCKET = "wardrobe-evidence";

type LifecycleRow =
  Database["public"]["Tables"]["wardrobe_lifecycle_events"]["Row"];
type SelfScanRow = Database["public"]["Tables"]["wardrobe_self_scans"]["Row"];
type AttachmentRow =
  Database["public"]["Tables"]["wardrobe_attachments"]["Row"];
type FittingObservationRow =
  Database["public"]["Tables"]["fitting_observations"]["Row"];

function toLifecycleEvent(row: LifecycleRow): WardrobeLifecycleEvent {
  return {
    id: asId<"WardrobeLifecycleEventId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    wardrobeItemId: asId<"WardrobeItemId">(row.wardrobe_item_id),
    eventKind: row.event_kind as WardrobeLifecycleEventKind,
    actorKind: row.actor_kind as WardrobeActorKind,
    ...(row.actor_staff_id
      ? { actorStaffId: asId<"StaffId">(row.actor_staff_id) }
      : {}),
    ...(row.note ? { note: row.note } : {}),
    ...(row.guidance_kind
      ? { guidanceKind: row.guidance_kind as LongevityGuidanceKind }
      : {}),
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}

function toSelfScan(row: SelfScanRow): WardrobeSelfScan {
  return {
    id: asId<"WardrobeSelfScanId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    wardrobeItemId: asId<"WardrobeItemId">(row.wardrobe_item_id),
    ...(row.notes ? { notes: row.notes } : {}),
    sizeChangeReported: row.size_change_reported,
    ...(row.fit_perception_at_scan
      ? {
          fitPerceptionAtScan:
            row.fit_perception_at_scan as WardrobeFitPerception,
        }
      : {}),
    provenance: WARDROBE_SELF_SCAN_PROVENANCE,
    serviceHandoffKind: row.service_handoff_kind as WardrobeServiceHandoffKind,
    ...(row.appointment_id
      ? { appointmentId: asId<"AppointmentId">(row.appointment_id) }
      : {}),
    ...(row.appointment_type
      ? {
          appointmentType: row.appointment_type as Extract<
            AppointmentType,
            "fitting" | "alteration_fitting"
          >,
        }
      : {}),
    createdByActor: row.created_by_actor as Exclude<
      WardrobeActorKind,
      "system"
    >,
    ...(row.created_by_staff_id
      ? { createdByStaffId: asId<"StaffId">(row.created_by_staff_id) }
      : {}),
    createdAt: row.created_at,
  };
}

function toAttachment(row: AttachmentRow): WardrobeAttachment {
  return {
    id: asId<"WardrobeAttachmentId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    wardrobeItemId: asId<"WardrobeItemId">(row.wardrobe_item_id),
    ...(row.self_scan_id
      ? { selfScanId: asId<"WardrobeSelfScanId">(row.self_scan_id) }
      : {}),
    kind: row.kind as WardrobeAttachmentKind,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    uploadedByActor: row.uploaded_by_actor as Exclude<
      WardrobeActorKind,
      "system"
    >,
    ...(row.uploaded_by_staff_id
      ? { uploadedByStaffId: asId<"StaffId">(row.uploaded_by_staff_id) }
      : {}),
    createdAt: row.created_at,
  };
}

export interface WardrobeAttachmentWithUrl {
  attachment: WardrobeAttachment;
  signedUrl: string;
}

export interface WardrobeItemServiceView {
  item: WardrobeItem;
  lifecycle: WardrobeLifecycleState;
  lifecycleEvents: readonly WardrobeLifecycleEvent[];
  longevityGuidance: readonly LongevityGuidanceItem[];
  fitFreshness: FitFreshnessProjection;
  selfScans: readonly WardrobeSelfScan[];
  selfScanEligible: boolean;
}

export class WardrobeLifecycleRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async listLifecycleEvents(
    wardrobeItemId: WardrobeItemId,
  ): Promise<WardrobeLifecycleEvent[]> {
    const { data, error } = await this.client
      .from("wardrobe_lifecycle_events")
      .select("*")
      .eq("wardrobe_item_id", wardrobeItemId)
      .order("occurred_at", { ascending: false });
    if (error) throw error;
    return data.map(toLifecycleEvent);
  }

  async recordLifecycleEvent(
    input: RecordWardrobeLifecycleEventInput,
  ): Promise<WardrobeLifecycleEventId> {
    const { data, error } = await this.client.rpc(
      "record_wardrobe_lifecycle_event",
      {
        p_wardrobe_item_id: input.wardrobeItemId,
        p_event_kind: input.eventKind,
        ...(input.note !== undefined ? { p_note: input.note } : {}),
        ...(input.guidanceKind !== undefined
          ? { p_guidance_kind: input.guidanceKind }
          : {}),
        ...(input.occurredAt !== undefined
          ? { p_occurred_at: input.occurredAt }
          : {}),
      },
    );
    if (error) throw error;
    return asId<"WardrobeLifecycleEventId">(data);
  }

  async listSelfScans(
    wardrobeItemId: WardrobeItemId,
  ): Promise<WardrobeSelfScan[]> {
    const { data, error } = await this.client
      .from("wardrobe_self_scans")
      .select("*")
      .eq("wardrobe_item_id", wardrobeItemId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toSelfScan);
  }

  async listSelfScansForCustomer(
    customerId: string,
  ): Promise<WardrobeSelfScan[]> {
    const { data, error } = await this.client
      .from("wardrobe_self_scans")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toSelfScan);
  }

  async submitSelfScan(
    input: SubmitWardrobeSelfScanInput,
  ): Promise<WardrobeSelfScanId> {
    const { data, error } = await this.client.rpc("submit_wardrobe_self_scan", {
      p_wardrobe_item_id: input.wardrobeItemId,
      p_size_change_reported: input.sizeChangeReported,
      p_request_service_handoff: input.requestServiceHandoff,
      ...(input.notes !== undefined ? { p_notes: input.notes } : {}),
      ...(input.fitPerceptionAtScan !== undefined
        ? { p_fit_perception_at_scan: input.fitPerceptionAtScan }
        : {}),
      ...(input.appointmentStartsAt !== undefined
        ? { p_appointment_starts_at: input.appointmentStartsAt }
        : {}),
      ...(input.appointmentEndsAt !== undefined
        ? { p_appointment_ends_at: input.appointmentEndsAt }
        : {}),
      ...(input.preferredAppointmentType !== undefined
        ? { p_preferred_appointment_type: input.preferredAppointmentType }
        : {}),
    });
    if (error) throw error;
    return asId<"WardrobeSelfScanId">(data);
  }

  async findAttachmentsByItem(
    wardrobeItemId: WardrobeItemId,
  ): Promise<WardrobeAttachmentWithUrl[]> {
    const { data, error } = await this.client
      .from("wardrobe_attachments")
      .select("*")
      .eq("wardrobe_item_id", wardrobeItemId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return Promise.all(
      data.map(async (row) => {
        const attachment = toAttachment(row);
        const { data: signed, error: signedError } = await this.client.storage
          .from(attachment.storageBucket)
          .createSignedUrl(attachment.storagePath, 15 * 60);
        if (signedError) throw signedError;
        return { attachment, signedUrl: signed.signedUrl };
      }),
    );
  }

  async uploadSelfScanImage(params: {
    retailerId: RetailerId;
    wardrobeItemId: WardrobeItemId;
    selfScanId: WardrobeSelfScanId;
    storagePath: string;
    fileName: string;
    mimeType: "image/jpeg" | "image/png" | "image/webp";
    sizeBytes: number;
    content: ArrayBuffer;
  }): Promise<WardrobeAttachment> {
    if (
      !isSecureWardrobeEvidencePath({
        storagePath: params.storagePath,
        retailerId: params.retailerId,
        wardrobeItemId: params.wardrobeItemId,
      })
    ) {
      throw new Error(
        "Storage path must be retailerId/wardrobeItemId/… with no path traversal.",
      );
    }

    const { error: uploadError } = await this.client.storage
      .from(EVIDENCE_BUCKET)
      .upload(params.storagePath, params.content, {
        contentType: params.mimeType,
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data, error } = await this.client.rpc(
      "record_wardrobe_attachment",
      {
        p_wardrobe_item_id: params.wardrobeItemId,
        p_storage_path: params.storagePath,
        p_file_name: params.fileName,
        p_mime_type: params.mimeType,
        p_size_bytes: params.sizeBytes,
        p_kind: "self_scan",
        p_self_scan_id: params.selfScanId,
      },
    );

    if (error) {
      await this.client.storage
        .from(EVIDENCE_BUCKET)
        .remove([params.storagePath]);
      throw error;
    }

    const { data: row, error: readError } = await this.client
      .from("wardrobe_attachments")
      .select("*")
      .eq("id", data)
      .single();
    if (readError) throw readError;
    return toAttachment(row);
  }

  async findLastOfficialMeasuredAt(
    physicalGarmentId: string,
  ): Promise<string | undefined> {
    const { data, error } = await this.client
      .from("fitting_observations")
      .select("created_at")
      .eq("physical_garment_id", physicalGarmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    const row = data as Pick<FittingObservationRow, "created_at"> | null;
    return row?.created_at;
  }

  async projectItemServiceView(
    item: WardrobeItem,
    nowIso: string = new Date().toISOString(),
  ): Promise<WardrobeItemServiceView> {
    const [lifecycleEvents, selfScans] = await Promise.all([
      this.listLifecycleEvents(item.id),
      this.listSelfScans(item.id),
    ]);
    const lifecycle = projectLifecycleState(lifecycleEvents);
    const lastOfficialMeasuredAt = item.physicalGarmentId
      ? await this.findLastOfficialMeasuredAt(item.physicalGarmentId)
      : undefined;

    const fitFreshness = projectFitFreshness({
      wardrobeItemId: item.id,
      ...(item.physicalGarmentId
        ? { physicalGarmentId: item.physicalGarmentId }
        : {}),
      ...(lastOfficialMeasuredAt ? { lastOfficialMeasuredAt } : {}),
      nowIso,
      selfReportedFitPerception: item.fitPerception,
      ...(item.fitNotes ? { selfReportedFitNotes: item.fitNotes } : {}),
    });

    return {
      item,
      lifecycle,
      lifecycleEvents,
      longevityGuidance: deriveLongevityGuidance({
        categoryCode: item.categoryCode,
        condition: item.condition,
        careState: item.careState,
        ...(item.wearFrequency ? { wearFrequency: item.wearFrequency } : {}),
        ...(item.acquiredAt ? { acquiredAt: item.acquiredAt } : {}),
        lifecycle,
        nowIso,
      }),
      fitFreshness,
      selfScans,
      selfScanEligible: isWardrobeItemSelfScanEligible(item),
    };
  }

  /**
   * Pure helper exposed for callers that already loaded observations —
   * proves self-scan handoff never claims official observation writes.
   */
  previewSelfScanHandoff(input: {
    sizeChangeReported: boolean;
    fitPerception?: WardrobeFitPerception;
    freshnessStatus: FitFreshnessProjection["status"];
    notes?: string;
  }) {
    return recommendFitServiceHandoff(input);
  }
}
