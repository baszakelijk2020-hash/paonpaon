import type {
  RetailerId,
  StaffId,
  UserId,
  WorkshopId,
} from "../shared/branded-id";
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
  readonly invitedAt: string;
  readonly acceptedAt?: string;
}

/**
 * A staff member's membership in one retailer's Retailer Portal.
 * `userId` is optional: the record exists (and can be invited to,
 * re-invited, or managed) before the person has an auth identity
 * attached, and the link is cleared if that identity is ever deleted.
 */
export interface RetailerStaffMember extends Timestamps {
  readonly id: StaffId;
  readonly userId?: UserId;
  readonly retailerId: RetailerId;
  readonly fullName: string;
  readonly email: string;
  readonly role: RetailerRole;
  readonly workshopId?: WorkshopId;
  readonly invitedAt: string;
  readonly acceptedAt?: string;
}
