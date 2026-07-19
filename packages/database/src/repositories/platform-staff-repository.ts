import {
  asId,
  type PlatformRole,
  type PlatformStaffMember,
  type UserId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type PlatformStaffRow =
  Database["public"]["Tables"]["platform_staff_members"]["Row"];

function toDomain(row: PlatformStaffRow): PlatformStaffMember {
  return {
    id: asId<"StaffId">(row.id),
    userId: asId<"UserId">(row.user_id),
    fullName: row.full_name,
    role: row.role,
    invitedAt: row.invited_at,
    ...(row.accepted_at ? { acceptedAt: row.accepted_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export interface CreatePlatformStaffParams {
  userId: UserId;
  fullName: string;
  role: PlatformRole;
}

export class PlatformStaffRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByUserId(userId: UserId): Promise<PlatformStaffMember | null> {
    const { data, error } = await this.client
      .from("platform_staff_members")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? toDomain(data) : null;
  }

  async list(): Promise<PlatformStaffMember[]> {
    const { data, error } = await this.client
      .from("platform_staff_members")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return data.map(toDomain);
  }

  async create(
    params: CreatePlatformStaffParams,
  ): Promise<PlatformStaffMember> {
    const { data, error } = await this.client
      .from("platform_staff_members")
      .insert({
        user_id: params.userId,
        full_name: params.fullName,
        role: params.role,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return toDomain(data);
  }

  async acceptInvite(id: string): Promise<string> {
    const { data, error } = await this.client.rpc(
      "accept_platform_staff_invite",
      { p_staff_id: id },
    );
    if (error) throw error;
    return data;
  }
}
