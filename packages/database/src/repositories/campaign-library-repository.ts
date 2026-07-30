/**
 * Campaign library repository (PHASE 10.1).
 */

import {
  CAMPAIGN_LIBRARY_PROJECTOR_VERSION,
  HONEYMOON_PHASE_LIBRARY_V1,
  MEMBER_FABRIC_LIBRARY_V1,
  SEVEN_DAY_WARDROBE_LIBRARY_V1,
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
        : record.kind === "order_journey"
          ? "order_journey"
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
    return this.ensureLibraryVersion(
      "private_offer_member_fabric",
      MEMBER_FABRIC_LIBRARY_V1,
    );
  }

  async ensureSevenDayWardrobeV1(): Promise<CampaignLibraryVersion> {
    return this.ensureLibraryVersion(
      "seven_day_wardrobe_v1",
      SEVEN_DAY_WARDROBE_LIBRARY_V1,
    );
  }

  async ensureHoneymoonPhaseV1(): Promise<CampaignLibraryVersion> {
    return this.ensureLibraryVersion(
      "honeymoon_phase_v1",
      HONEYMOON_PHASE_LIBRARY_V1,
    );
  }

  private async ensureLibraryVersion(
    key: CampaignLibraryKey,
    snapshot: CampaignLibrarySnapshot,
  ): Promise<CampaignLibraryVersion> {
    const existing = await this.getActiveVersion(key);
    if (existing) return existing;

    const { data: entry, error: entryError } = await this.client
      .from("campaign_library_entries")
      .select("*")
      .eq("key", key)
      .single();
    if (entryError) throw entryError;

    const { data, error } = await this.client
      .from("campaign_library_versions")
      .insert({
        entry_id: entry.id,
        version_number: 1,
        status: "active",
        snapshot: snapshot as unknown as Json,
        activated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return toVersion(data);
  }

  async listActiveVersions(): Promise<
    readonly {
      readonly entry: CampaignLibraryEntry;
      readonly version: CampaignLibraryVersion;
    }[]
  > {
    const entries = await this.listEntries();
    const results: {
      entry: CampaignLibraryEntry;
      version: CampaignLibraryVersion;
    }[] = [];
    for (const entry of entries) {
      const version = await this.getActiveVersion(entry.key);
      if (version) {
        results.push({ entry, version });
      }
    }
    return results;
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
    const version = await this.resolveActiveVersion(args.key);
    const campaignKind =
      version.snapshot.kind === "order_journey"
        ? "order_journey"
        : version.snapshot.kind;

    const { data, error } = await this.client
      .from("campaigns")
      .insert({
        retailer_id: args.retailerId,
        kind: campaignKind,
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
        ...(campaignKind === "wardrobe_challenge"
          ? {
              reward_kind: "personalized_tie",
              reward_label: "A personalised tie for completing seven looks",
            }
          : {}),
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

  private async resolveActiveVersion(
    key: CampaignLibraryKey,
  ): Promise<CampaignLibraryVersion> {
    switch (key) {
      case "private_offer_member_fabric":
        return this.ensureMemberFabricV1();
      case "seven_day_wardrobe_v1":
        return this.ensureSevenDayWardrobeV1();
      case "honeymoon_phase_v1":
        return this.ensureHoneymoonPhaseV1();
      default: {
        const _exhaustive: never = key;
        throw new Error(`Unsupported library key ${_exhaustive}`);
      }
    }
  }
}
