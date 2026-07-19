import type {
  AccountType,
  CustomerId,
  RetailerId,
  RetailerRole,
  UserId,
} from "@paon/domain";

/**
 * Normalized session shape every app derives from Supabase auth + the
 * appropriate identity table (PlatformStaffMember / RetailerStaffMember
 * / Customer) on each request. Each app's middleware is responsible for
 * rejecting a session whose accountType doesn't match that app.
 */
export interface AppSession {
  readonly userId: UserId;
  readonly email: string;
  readonly accountType: AccountType;
  readonly retailerId?: RetailerId;
  readonly retailerRole?: RetailerRole;
  readonly customerId?: CustomerId;
}
