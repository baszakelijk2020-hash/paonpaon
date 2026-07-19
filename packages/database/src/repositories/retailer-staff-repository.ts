import {
  asId,
  type RetailerId,
  type RetailerRole,
  type RetailerStaffMember,
  type StaffId,
  type UserId,
  type WorkshopId,
} from "@paon/domain";
import type { PostgrestError } from "@supabase/supabase-js";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type RetailerStaffRow =
  Database["public"]["Tables"]["retailer_staff_members"]["Row"];

const UNIQUE_VIOLATION = "23505";

export class StaffEmailAlreadyInvitedError extends Error {
  constructor(public readonly email: string) {
    super(`"${email}" has already been invited to this retailer.`);
    this.name = "StaffEmailAlreadyInvitedError";
  }
}

function isUniqueViolation(error: PostgrestError): boolean {
  return error.code === UNIQUE_VIOLATION;
}

function toDomain(row: RetailerStaffRow): RetailerStaffMember {
  return {
    id: asId<"StaffId">(row.id),
    ...(row.user_id ? { userId: asId<"UserId">(row.user_id) } : {}),
    retailerId: asId<"RetailerId">(row.retailer_id),
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    ...(row.workshop_id
      ? { workshopId: asId<"WorkshopId">(row.workshop_id) }
      : {}),
    invitedAt: row.invited_at,
    ...(row.accepted_at ? { acceptedAt: row.accepted_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export interface CreateRetailerStaffParams {
  retailerId: RetailerId;
  userId: UserId;
  fullName: string;
  email: string;
  role: RetailerRole;
  workshopId?: WorkshopId;
}

/**
 * `userId` is required here: the caller (a Server Action) must have
 * already provisioned the auth.users row via
 * `supabase.auth.admin.inviteUserByEmail` before persisting the staff
 * record, so the claim-sync trigger (see the
 * create_retailer_staff_members migration) has a user to attach
 * app_metadata to immediately. See docs/DECISIONS.md ADR-009.
 */
export class RetailerStaffRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByRetailer(retailerId: RetailerId): Promise<RetailerStaffMember[]> {
    const { data, error } = await this.client
      .from("retailer_staff_members")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return data.map(toDomain);
  }

  async findByUserId(userId: UserId): Promise<RetailerStaffMember | null> {
    const { data, error } = await this.client
      .from("retailer_staff_members")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? toDomain(data) : null;
  }

  async create(
    params: CreateRetailerStaffParams,
  ): Promise<RetailerStaffMember> {
    const { data, error } = await this.client
      .from("retailer_staff_members")
      .insert({
        retailer_id: params.retailerId,
        user_id: params.userId,
        full_name: params.fullName,
        email: params.email,
        role: params.role,
        workshop_id: params.workshopId ?? null,
      })
      .select("*")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        throw new StaffEmailAlreadyInvitedError(params.email);
      }
      throw error;
    }

    return toDomain(data);
  }

  /**
   * Calls `accept_retailer_staff_invite` — see docs/DECISIONS.md
   * ADR-012 for why this is a security definer RPC rather than a
   * direct `update` this repository would otherwise expose. Never
   * duplicate the accepted-at / retailer-activation logic here.
   */
  async acceptInvite(staffId: StaffId): Promise<void> {
    const { error } = await this.client.rpc("accept_retailer_staff_invite", {
      p_staff_id: staffId,
    });

    if (error) {
      throw error;
    }
  }
}
