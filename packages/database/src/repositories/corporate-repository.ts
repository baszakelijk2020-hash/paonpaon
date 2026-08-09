import {
  asId,
  computeExceptionDueAt,
  type CorporateAccount,
  type CorporateAccountId,
  type CorporateAnnouncement,
  type CorporateException,
  type CorporateExceptionEvent,
  type CorporateExceptionEventType,
  type CorporateExceptionKind,
  type CorporateExceptionPriority,
  type CorporateIssueRecordEntity,
  type CorporateProgramme,
  type CorporateWearer,
  type CreateCorporateAccountInput,
  type CreateCorporateExceptionInput,
  type CreateCorporateProgrammeInput,
  type CreateCorporateWearerInput,
  type EntitlementRule,
  type CorporateEntitlementVersionRecord,
  type LeaverAction,
  type RecordCorporateIssueInput,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type AccountRow = Database["public"]["Tables"]["corporate_accounts"]["Row"];
type ProgrammeRow = Database["public"]["Tables"]["corporate_programmes"]["Row"];
type EntitlementVersionRow =
  Database["public"]["Tables"]["corporate_entitlement_versions"]["Row"];
type WearerRow = Database["public"]["Tables"]["corporate_wearers"]["Row"];
type IssueRecordRow =
  Database["public"]["Tables"]["corporate_issue_records"]["Row"];
type ExceptionRow = Database["public"]["Tables"]["corporate_exceptions"]["Row"];
type AnnouncementRow =
  Database["public"]["Tables"]["corporate_announcements"]["Row"];

function toAnnouncement(row: AnnouncementRow): CorporateAnnouncement {
  return {
    id: asId<"CorporateAnnouncementId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    programmeId: asId<"CorporateProgrammeId">(row.programme_id),
    title: row.title,
    body: row.body,
    authoredByStaffId: row.authored_by_staff_id,
    ...(row.published_at ? { publishedAt: row.published_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAccount(row: AccountRow): CorporateAccount {
  return {
    id: asId<"CorporateAccountId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    legalName: row.legal_name,
    accountReference: row.account_reference,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toProgramme(row: ProgrammeRow): CorporateProgramme {
  return {
    id: asId<"CorporateProgrammeId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    accountId: asId<"CorporateAccountId">(row.account_id),
    name: row.name,
    siteKeys: row.site_keys,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toEntitlementVersion(
  row: EntitlementVersionRow,
): CorporateEntitlementVersionRecord {
  return {
    id: asId<"CorporateEntitlementVersionId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    programmeId: asId<"CorporateProgrammeId">(row.programme_id),
    version: row.version,
    effectiveFrom: row.effective_from,
    rules: row.rules as unknown as readonly EntitlementRule[],
    createdAt: row.created_at,
  };
}

function toWearer(row: WearerRow): CorporateWearer {
  return {
    id: asId<"CorporateWearerId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    programmeId: asId<"CorporateProgrammeId">(row.programme_id),
    ...(row.customer_id
      ? { customerId: asId<"CustomerId">(row.customer_id) }
      : {}),
    employeeReference: row.employee_reference,
    displayName: row.display_name,
    roleKey: row.role_key,
    ...(row.site_key ? { siteKey: row.site_key } : {}),
    joinedOn: row.joined_on,
    active: row.active,
    ...(row.garment_adaptation_note
      ? { garmentAdaptationNote: row.garment_adaptation_note }
      : {}),
    ...(row.login_email ? { loginEmail: row.login_email } : {}),
    ...(row.user_id ? { userId: row.user_id } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toIssueRecord(row: IssueRecordRow): CorporateIssueRecordEntity {
  return {
    id: asId<"CorporateIssueRecordId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    wearerId: asId<"CorporateWearerId">(row.wearer_id),
    entitlementVersionId: asId<"CorporateEntitlementVersionId">(
      row.entitlement_version_id,
    ),
    garmentKey: row.garment_key,
    quantity: row.quantity,
    ...(row.order_id ? { orderId: asId<"OrderId">(row.order_id) } : {}),
    issuedOn: row.issued_on,
    createdAt: row.created_at,
  };
}

function toException(row: ExceptionRow): CorporateException {
  return {
    id: asId<"CorporateExceptionId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    programmeId: asId<"CorporateProgrammeId">(row.programme_id),
    ...(row.wearer_id
      ? { wearerId: asId<"CorporateWearerId">(row.wearer_id) }
      : {}),
    kind: row.kind as CorporateExceptionKind,
    ...(row.garment_key ? { garmentKey: row.garment_key } : {}),
    ...(row.quantity !== null ? { quantity: row.quantity } : {}),
    ...(row.action ? { action: row.action as LeaverAction } : {}),
    detail: row.detail,
    ...(row.resolved_at ? { resolvedAt: row.resolved_at } : {}),
    ...(row.priority ? { priority: row.priority } : {}),
    ...(row.due_at ? { dueAt: row.due_at } : {}),
    ...(row.assigned_staff_id
      ? { assignedStaffId: row.assigned_staff_id }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Métier corporate wardrobe programmes — see docs/DECISIONS.md CORP-101..106 / PHASE 14.1. Retailer-staff only; see `packages/domain/src/corporate/corporate-programme.ts` for why. */
export class CorporateRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findAccountsByRetailer(
    retailerId: RetailerId,
  ): Promise<CorporateAccount[]> {
    const { data, error } = await this.client
      .from("corporate_accounts")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("legal_name", { ascending: true });
    if (error) throw error;
    return data.map(toAccount);
  }

  async findAccountById(
    accountId: CorporateAccountId,
  ): Promise<CorporateAccount | null> {
    const { data, error } = await this.client
      .from("corporate_accounts")
      .select("*")
      .eq("id", accountId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toAccount(data) : null;
  }

  async createAccount(
    retailerId: RetailerId,
    input: CreateCorporateAccountInput,
  ): Promise<CorporateAccount> {
    const { data, error } = await this.client
      .from("corporate_accounts")
      .insert({
        retailer_id: retailerId,
        legal_name: input.legalName,
        account_reference: input.accountReference,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toAccount(data);
  }

  async findProgrammesByRetailer(
    retailerId: RetailerId,
  ): Promise<CorporateProgramme[]> {
    const { data, error } = await this.client
      .from("corporate_programmes")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("name", { ascending: true });
    if (error) throw error;
    return data.map(toProgramme);
  }

  async findProgrammeById(
    programmeId: string,
  ): Promise<CorporateProgramme | null> {
    const { data, error } = await this.client
      .from("corporate_programmes")
      .select("*")
      .eq("id", programmeId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toProgramme(data) : null;
  }

  async createProgramme(
    retailerId: RetailerId,
    input: CreateCorporateProgrammeInput,
  ): Promise<CorporateProgramme> {
    const { data, error } = await this.client
      .from("corporate_programmes")
      .insert({
        retailer_id: retailerId,
        account_id: input.accountId,
        name: input.name,
        site_keys: input.siteKeys,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toProgramme(data);
  }

  async findEntitlementVersions(
    programmeId: string,
  ): Promise<CorporateEntitlementVersionRecord[]> {
    const { data, error } = await this.client
      .from("corporate_entitlement_versions")
      .select("*")
      .eq("programme_id", programmeId)
      .order("version", { ascending: false });
    if (error) throw error;
    return data.map(toEntitlementVersion);
  }

  async findLatestEntitlementVersion(
    programmeId: string,
  ): Promise<CorporateEntitlementVersionRecord | null> {
    const versions = await this.findEntitlementVersions(programmeId);
    return versions[0] ?? null;
  }

  /** Append-only: the next version number is derived here, never edited in place. */
  async createEntitlementVersion(
    retailerId: RetailerId,
    input: {
      programmeId: string;
      effectiveFrom: string;
      rules: readonly EntitlementRule[];
    },
  ): Promise<CorporateEntitlementVersionRecord> {
    const latest = await this.findLatestEntitlementVersion(input.programmeId);
    const { data, error } = await this.client
      .from("corporate_entitlement_versions")
      .insert({
        retailer_id: retailerId,
        programme_id: input.programmeId,
        version: (latest?.version ?? 0) + 1,
        effective_from: input.effectiveFrom,
        rules:
          input.rules as unknown as Database["public"]["Tables"]["corporate_entitlement_versions"]["Insert"]["rules"],
      })
      .select("*")
      .single();
    if (error) throw error;
    return toEntitlementVersion(data);
  }

  async findWearersByProgramme(
    programmeId: string,
  ): Promise<CorporateWearer[]> {
    const { data, error } = await this.client
      .from("corporate_wearers")
      .select("*")
      .eq("programme_id", programmeId)
      .is("deleted_at", null)
      .order("display_name", { ascending: true });
    if (error) throw error;
    return data.map(toWearer);
  }

  async findWearerById(wearerId: string): Promise<CorporateWearer | null> {
    const { data, error } = await this.client
      .from("corporate_wearers")
      .select("*")
      .eq("id", wearerId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toWearer(data) : null;
  }

  /** The Employee Portal's own lookup — `user_id` is set by
   * `linkMyWearerAccount`, never chosen by the caller. */
  async findWearerByUserId(userId: string): Promise<CorporateWearer | null> {
    const { data, error } = await this.client
      .from("corporate_wearers")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toWearer(data) : null;
  }

  /** Links every still-unlinked `corporate_wearers` row matching the
   * caller's own verified email to their Employee Portal login.
   * Idempotent; mirrors `CustomerRepository.linkMyAccounts` exactly. */
  async linkMyWearerAccount(): Promise<void> {
    const { error } = await this.client.rpc("link_my_wearer_account");
    if (error) throw error;
  }

  async createWearer(
    retailerId: RetailerId,
    input: CreateCorporateWearerInput,
  ): Promise<CorporateWearer> {
    const { data, error } = await this.client
      .from("corporate_wearers")
      .insert({
        retailer_id: retailerId,
        programme_id: input.programmeId,
        employee_reference: input.employeeReference,
        display_name: input.displayName,
        role_key: input.roleKey,
        site_key: input.siteKey ?? null,
        joined_on: input.joinedOn,
        garment_adaptation_note: input.garmentAdaptationNote ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toWearer(data);
  }

  async setWearerActive(wearerId: string, active: boolean): Promise<void> {
    const { error } = await this.client
      .from("corporate_wearers")
      .update({ active })
      .eq("id", wearerId);
    if (error) throw error;
  }

  /** Grants (or revokes, with `null`) Employee Portal login access —
   * see the migration header for why this is a separate column from
   * any linked customer's email. */
  async setWearerLoginEmail(
    wearerId: string,
    loginEmail: string | null,
  ): Promise<void> {
    const { error } = await this.client
      .from("corporate_wearers")
      .update({ login_email: loginEmail })
      .eq("id", wearerId);
    if (error) throw error;
  }

  /** Links (or unlinks, with `null`) this wearer's real retail Customer
   * relationship (PHASE 18.5 / migration 20260809200000) — surfaces
   * appointments/orders/alterations/measurements on the Employee Portal.
   * `check_corporate_wearer_customer_tenant` refuses a cross-tenant
   * customer_id server-side; this is only the request shape. */
  async setWearerCustomerId(
    wearerId: string,
    customerId: string | null,
  ): Promise<void> {
    const { error } = await this.client
      .from("corporate_wearers")
      .update({ customer_id: customerId })
      .eq("id", wearerId);
    if (error) throw error;
  }

  async findIssuesByWearer(
    wearerId: string,
  ): Promise<CorporateIssueRecordEntity[]> {
    const { data, error } = await this.client
      .from("corporate_issue_records")
      .select("*")
      .eq("wearer_id", wearerId)
      .order("issued_on", { ascending: false });
    if (error) throw error;
    return data.map(toIssueRecord);
  }

  async findIssuesByProgramme(
    programmeId: string,
  ): Promise<CorporateIssueRecordEntity[]> {
    const wearers = await this.findWearersByProgramme(programmeId);
    if (wearers.length === 0) return [];
    const { data, error } = await this.client
      .from("corporate_issue_records")
      .select("*")
      .in(
        "wearer_id",
        wearers.map((wearer) => wearer.id),
      )
      .order("issued_on", { ascending: false });
    if (error) throw error;
    return data.map(toIssueRecord);
  }

  /** Append-only: a correction is a new row, never an edit — see 20260801000016. */
  async recordIssue(
    retailerId: RetailerId,
    input: RecordCorporateIssueInput,
  ): Promise<CorporateIssueRecordEntity> {
    const { data, error } = await this.client
      .from("corporate_issue_records")
      .insert({
        retailer_id: retailerId,
        wearer_id: input.wearerId,
        entitlement_version_id: input.entitlementVersionId,
        garment_key: input.garmentKey,
        quantity: input.quantity,
        issued_on: input.issuedOn,
        order_id: input.orderId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toIssueRecord(data);
  }

  async findExceptionsByProgramme(
    programmeId: string,
  ): Promise<CorporateException[]> {
    const { data, error } = await this.client
      .from("corporate_exceptions")
      .select("*")
      .eq("programme_id", programmeId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toException);
  }

  async createException(
    retailerId: RetailerId,
    input: CreateCorporateExceptionInput,
  ): Promise<CorporateException> {
    const now = new Date().toISOString();
    const priority = input.priority ?? "normal";
    const { data, error } = await this.client
      .from("corporate_exceptions")
      .insert({
        retailer_id: retailerId,
        programme_id: input.programmeId,
        wearer_id: input.wearerId ?? null,
        kind: input.kind,
        garment_key: input.garmentKey ?? null,
        quantity: input.quantity ?? null,
        action: input.action ?? null,
        detail: input.detail,
        priority,
        due_at: computeExceptionDueAt({ priority, fromIso: now }),
      })
      .select("*")
      .single();
    if (error) throw error;
    await this.writeExceptionEvent({
      retailerId,
      exceptionId: data.id,
      eventType: "created",
    });
    return toException(data);
  }

  async resolveException(
    exceptionId: string,
    retailerId: RetailerId,
  ): Promise<CorporateException> {
    const { data, error } = await this.client
      .from("corporate_exceptions")
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", exceptionId)
      .select("*")
      .single();
    if (error) throw error;
    await this.writeExceptionEvent({
      retailerId,
      exceptionId,
      eventType: "resolved",
    });
    return toException(data);
  }

  /** Reassignment is visible on the ticket AND on its audit trail — the
   * row alone cannot answer "who had this before". */
  async assignException(args: {
    readonly retailerId: RetailerId;
    readonly exceptionId: string;
    readonly staffId: string;
  }): Promise<CorporateException> {
    const { data, error } = await this.client
      .from("corporate_exceptions")
      .update({ assigned_staff_id: args.staffId })
      .eq("id", args.exceptionId)
      .select("*")
      .single();
    if (error) throw error;
    await this.writeExceptionEvent({
      retailerId: args.retailerId,
      exceptionId: args.exceptionId,
      eventType: "assigned",
      detail: args.staffId,
    });
    return toException(data);
  }

  /** Recomputes `due_at` from the moment of the change, not the ticket's
   * original creation — an SLA that started counting down under the old
   * priority should not silently keep that old clock. */
  async changeExceptionPriority(args: {
    readonly retailerId: RetailerId;
    readonly exceptionId: string;
    readonly priority: CorporateExceptionPriority;
  }): Promise<CorporateException> {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from("corporate_exceptions")
      .update({
        priority: args.priority,
        due_at: computeExceptionDueAt({
          priority: args.priority,
          fromIso: now,
        }),
      })
      .eq("id", args.exceptionId)
      .select("*")
      .single();
    if (error) throw error;
    await this.writeExceptionEvent({
      retailerId: args.retailerId,
      exceptionId: args.exceptionId,
      eventType: "priority_changed",
      detail: args.priority,
    });
    return toException(data);
  }

  async listExceptionEvents(
    exceptionId: string,
  ): Promise<readonly CorporateExceptionEvent[]> {
    const { data, error } = await this.client
      .from("corporate_exception_events")
      .select("*")
      .eq("exception_id", exceptionId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data.map((row) => ({
      id: row.id,
      exceptionId: row.exception_id,
      eventType: row.event_type as CorporateExceptionEventType,
      ...(row.detail ? { detail: row.detail } : {}),
      ...(row.actor_staff_id ? { actorStaffId: row.actor_staff_id } : {}),
      createdAt: row.created_at,
    }));
  }

  private async writeExceptionEvent(args: {
    readonly retailerId: RetailerId;
    readonly exceptionId: string;
    readonly eventType: CorporateExceptionEventType;
    readonly detail?: string;
    readonly actorStaffId?: string;
  }): Promise<void> {
    const { error } = await this.client
      .from("corporate_exception_events")
      .insert({
        retailer_id: args.retailerId,
        exception_id: args.exceptionId,
        event_type: args.eventType,
        detail: args.detail ?? null,
        actor_staff_id: args.actorStaffId ?? null,
      });
    if (error) throw error;
  }

  async findOpenRenewalTask(programmeId: string): Promise<{
    readonly id: string;
    readonly reason: string;
  } | null> {
    const { data, error } = await this.client
      .from("corporate_renewal_tasks")
      .select("id, reason")
      .eq("programme_id", programmeId)
      .eq("status", "open")
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async resolveRenewalTask(taskId: string): Promise<void> {
    const { error } = await this.client
      .from("corporate_renewal_tasks")
      .update({ status: "done", resolved_at: new Date().toISOString() })
      .eq("id", taskId);
    if (error) throw error;
  }

  /** A manager writes a draft; `publishedAt` stays unset until
   * `publishAnnouncement` is called — never visible to a wearer before
   * that (PHASE 18.5 / BD-105). */
  async createAnnouncement(
    retailerId: RetailerId,
    input: {
      readonly programmeId: string;
      readonly title: string;
      readonly body: string;
      readonly authoredByStaffId: string;
    },
  ): Promise<CorporateAnnouncement> {
    const { data, error } = await this.client
      .from("corporate_announcements")
      .insert({
        retailer_id: retailerId,
        programme_id: input.programmeId,
        title: input.title,
        body: input.body,
        authored_by_staff_id: input.authoredByStaffId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toAnnouncement(data);
  }

  async publishAnnouncement(announcementId: string): Promise<void> {
    const { error } = await this.client
      .from("corporate_announcements")
      .update({ published_at: new Date().toISOString() })
      .eq("id", announcementId);
    if (error) throw error;
  }

  /** Staff view: every announcement for the programme, draft and
   * published, most recent first. */
  async findAnnouncementsByProgramme(
    programmeId: string,
  ): Promise<readonly CorporateAnnouncement[]> {
    const { data, error } = await this.client
      .from("corporate_announcements")
      .select("*")
      .eq("programme_id", programmeId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toAnnouncement);
  }

  /** Wearer view: RLS itself already restricts this to published
   * announcements for the caller's own programme — no extra filter
   * needed here, same posture `findExceptionsByProgramme` already
   * documents for the wearer-select policy. */
  async findPublishedAnnouncementsForProgramme(
    programmeId: string,
  ): Promise<readonly CorporateAnnouncement[]> {
    const { data, error } = await this.client
      .from("corporate_announcements")
      .select("*")
      .eq("programme_id", programmeId)
      .is("deleted_at", null)
      .order("published_at", { ascending: false });
    if (error) throw error;
    return data.map(toAnnouncement);
  }
}
