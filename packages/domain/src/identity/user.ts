import type { RetailerId, StaffId, UserId } from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

import type { AccountType, PlatformRole, RetailerRole } from "./role";

/**
 * A User is the authentication identity (mirrors a Supabase auth.users
 * row). It carries no business data itself — profile data lives in
 * PlatformStaff, RetailerStaff or Customer depending on accountType.
 * One auth identity maps to exactly one accountType; a person who is
 * both a retailer's staff member and a shopper elsewhere holds two
 * separate User rows with different emails, by design (least privilege
 * across tenant boundaries).
 */
export interface User extends Timestamps {
  readonly id: UserId;
  readonly email: string;
  readonly accountType: AccountType;
  readonly lastSignInAt?: string;
  readonly mfaEnabled: boolean;
}

export interface PlatformStaffMember extends Timestamps {
  readonly id: StaffId;
  readonly userId: UserId;
  readonly fullName: string;
  readonly role: PlatformRole;
}

/** A staff member's membership in one retailer's Retailer Portal. */
export interface RetailerStaffMember extends Timestamps {
  readonly id: StaffId;
  readonly userId: UserId;
  readonly retailerId: RetailerId;
  readonly fullName: string;
  readonly role: RetailerRole;
  readonly invitedAt: string;
  readonly acceptedAt?: string;
}
