/**
 * Campaign library repository (PHASE 10.1).
 */

import {
  CAMPAIGN_LIBRARY_PROJECTOR_VERSION,
  MEMBER_FABRIC_LIBRARY_V1,
  type CampaignLibraryEntry,
  type CampaignLibraryKey,
  type CampaignLibrarySnapshot,
  type CampaignLibraryVersion,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type EntryRow = Database["public"]["Tables"]["campaign_library_entries"]["Row"];
type VersionRow =
  Database["public"]["Tables"]["campaign_library_versions"]["Row"];

function toSnapshot(value: Json): CampaignLibrarySnapshot {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Campaign library snapshot must be an object");
  }
  const record = value as Record<string, unknown>;
  return {
    versionLabel: String(record.versionLabel ?? ""),
    kind:
      record.kind === "wardrobe_challenge"
        ? "wardrobe_challenge"
        : "private_offer",
    title: String(record.title ?? ""),
    summary: String(record.summary ?? ""),
    prerequisites: Array.isArray(record.prerequisites)
      ? record.prerequisites.map(String)
      : [],
    placementHints: Array.isArray(record.placementHints)
      ? record.placementHints.map(String)
      : [],
    staffMission: String(record.staffMission ?? ""),
    outcomeMetrics: Array.isArray(record.outcomeMetrics)
      ? record.outcomeMetrics.map(String)
      : [],
    audienceTemplate:
      record.audienceTemplate &&
      typeof record.audienceTemplate === "object" &&
      !Array.isArray(record.audienceTemplate)
        ? Object.fromEntries(
            Object.entries(
              record.audienceTemplate as Record<string, unknown>,
            ).map(([key, val]) => [key, String(val)]),
          )
        : {},
  };
}

function toEntry(row: EntryRow): CampaignLibraryEntry {
  return {
    id: row.id,
    key: row.key as CampaignLibraryKey,
    displayName: row.display_name,
  };
}

function toVersion(row: VersionRow): CampaignLibraryVersion {
  return {
    id: row.id,
    entryId: row.entry_id,
    versionNumber: row.version_number,
    status: row.status as CampaignLibraryVersion["status"],
    snapshot: toSnapshot(row.snapshot),
    ...(row.activated_at ? { activatedAt: row.activated_at } : {}),
  };
}

export class CampaignLibraryRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async listEntries(): Promise<CampaignLibraryEntry[]> {
    const { data, error } = await this.client
      .from("campaign_library_entries")
      .select("*")
      .order("key", { ascending: true });
    if (error) throw error;
    return data.map(toEntry);
  }

  async getActiveVersion(
    key: CampaignLibraryKey,
  ): Promise<CampaignLibraryVersion | null> {
    const { data: entry, error: entryError } = await this.client
      .from("campaign_library_entries")
      .select("*")
      .eq("key", key)
      .maybeSingle();
    if (entryError) throw entryError;
    if (!entry) return null;

    const { data, error } = await this.client
      .from("campaign_library_versions")
      .select("*")
      .eq("entry_id", entry.id)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw error;
    return data ? toVersion(data) : null;
  }

  async ensureMemberFabricV1(): Promise<CampaignLibraryVersion> {
    const existing = await this.getActiveVersion("private_offer_member_fabric");
    if (existing) return existing;

    const { data: entry, error: entryError } = await this.client
      .from("campaign_library_entries")
      .select("*")
      .eq("key", "private_offer_member_fabric")
      .single();
    if (entryError) throw entryError;

    const { data, error } = await this.client
      .from("campaign_library_versions")
      .insert({
        entry_id: entry.id,
        version_number: 1,
        status: "active",
        snapshot: MEMBER_FABRIC_LIBRARY_V1 as unknown as Json,
        activated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return toVersion(data);
  }

  /**
   * Clones the active library version into a retailer draft campaign,
   * pinning library_version_id so later library publishes do not mutate it.
   */
  async cloneActiveToRetailer(args: {
    readonly retailerId: RetailerId;
    readonly key: CampaignLibraryKey;
    readonly createdByStaffId?: string;
  }): Promise<{
    readonly campaignId: string;
    readonly libraryVersionId: string;
    readonly projectorVersion: string;
  }> {
    const version = await this.ensureMemberFabricV1();
    if (args.key !== "private_offer_member_fabric") {
      throw new Error(`Unsupported library key ${args.key}`);
    }

    const { data, error } = await this.client
      .from("campaigns")
      .insert({
        retailer_id: args.retailerId,
        kind: version.snapshot.kind,
        status: "draft",
        title: version.snapshot.title,
        summary: version.snapshot.summary,
        explanation: version.snapshot.staffMission,
        ...(args.createdByStaffId
          ? { created_by_staff_id: args.createdByStaffId }
          : {}),
        library_entry_id: version.entryId,
        library_version_id: version.id,
        library_pinned_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;

    return {
      campaignId: data.id,
      libraryVersionId: version.id,
      projectorVersion: CAMPAIGN_LIBRARY_PROJECTOR_VERSION,
    };
  }
}
