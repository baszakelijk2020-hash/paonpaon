"use server";

import { NetworkRepository } from "@paon/database";
import {
  asId,
  retailerRoleAtLeast,
  type AttributionOutcome,
  type PartnerPayload,
  type RetailerId,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface NetworkActionState {
  formError?: string;
  notice?: string;
  outcome?: AttributionOutcome;
  partnerPayloads?: readonly PartnerPayload[];
}

async function context() {
  const session = await requireModuleSession("network_ecosystem", "mutate");
  if (!retailerRoleAtLeast(session.retailerRole, "manager")) {
    throw new Error("Only a manager or above can curate the partner network.");
  }
  const supabase = await getSupabaseServerClient();
  return { session, supabase, network: new NetworkRepository(supabase) };
}

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function createPartner(
  _previous: NetworkActionState,
  formData: FormData,
): Promise<NetworkActionState> {
  const { session, network } = await context();
  const displayName = field(formData, "displayName");
  const partnerKey = field(formData, "partnerKey");
  const disclosureText = field(formData, "disclosureText");
  if (!displayName || !partnerKey) {
    return { formError: "Name and key are both required." };
  }
  if (disclosureText.length < 10) {
    return {
      formError:
        "Disclosure text must say plainly this is a paid or commercial placement — at least 10 characters.",
    };
  }
  await network.createPartner({
    retailerId: session.retailerId,
    displayName,
    partnerKey,
    disclosureText,
  });
  revalidatePath("/network");
  return { notice: "Partner added." };
}

export async function createListing(
  _previous: NetworkActionState,
  formData: FormData,
): Promise<NetworkActionState> {
  const { session, network } = await context();
  const partnerId = field(formData, "partnerId");
  const title = field(formData, "title");
  const destinationUrl = field(formData, "destinationUrl");
  if (!partnerId || !title || !destinationUrl) {
    return { formError: "Partner, title and destination link are required." };
  }
  await network.createListing({
    retailerId: session.retailerId,
    partnerId,
    title,
    description: field(formData, "description"),
    destinationUrl,
  });
  revalidatePath("/network");
  return { notice: "Listing created." };
}

export async function setListingActive(
  _previous: NetworkActionState,
  formData: FormData,
): Promise<NetworkActionState> {
  const { session, network } = await context();
  const listingId = field(formData, "listingId");
  const active = field(formData, "active") === "true";
  await network.setListingActive({
    retailerId: session.retailerId,
    listingId,
    active,
  });
  revalidatePath("/network");
  return { notice: active ? "Listing activated." : "Listing deactivated." };
}

async function snapshotAfter(args: {
  readonly network: NetworkRepository;
  readonly retailerId: RetailerId;
  readonly listingId: string;
  readonly pseudonymousRef: string;
}): Promise<NetworkActionState> {
  const [outcome, events] = await Promise.all([
    args.network.resolveListingAttribution({
      retailerId: args.retailerId,
      listingId: args.listingId,
      pseudonymousRef: args.pseudonymousRef,
    }),
    args.network.listAttributionEvents({
      retailerId: args.retailerId,
      listingId: args.listingId,
      pseudonymousRef: args.pseudonymousRef,
    }),
  ]);
  return {
    notice: `State: ${outcome.state}. ${outcome.rationale}`,
    outcome,
    partnerPayloads: events.map((event) =>
      args.network.buildPartnerPayload(event),
    ),
  };
}

/**
 * A demo conversion journey, driven from the retailer side so the honesty
 * properties (pseudonymous payload, hold-then-confirm, refund reverses to
 * zero) can be proven end to end without a live partner integration.
 * `resolvePseudonym` is the one call in this file that needs the
 * service-role client — `network_pseudonym_map` grants no other access.
 */
export async function recordClick(
  _previous: NetworkActionState,
  formData: FormData,
): Promise<NetworkActionState> {
  const { session, network } = await context();
  const listingId = field(formData, "listingId");
  const customerId = asId<"CustomerId">(field(formData, "customerId"));
  const partnerId = field(formData, "partnerId");
  if (!listingId || !customerId || !partnerId) {
    return { formError: "Choose a listing and a customer first." };
  }

  const admin = new NetworkRepository(getSupabaseAdminClient());
  const pseudonymousRef = await admin.resolvePseudonym({
    retailerId: session.retailerId,
    customerId,
    partnerId,
  });
  await network.recordAttributionEvent({
    retailerId: session.retailerId,
    listingId,
    pseudonymousRef,
    event: "click",
    providerEventKey: `click_${listingId}_${customerId}_${Date.now()}`,
  });
  revalidatePath("/network");
  return snapshotAfter({
    network,
    retailerId: session.retailerId,
    listingId,
    pseudonymousRef,
  });
}

export async function confirmOrder(
  _previous: NetworkActionState,
  formData: FormData,
): Promise<NetworkActionState> {
  const { session, network } = await context();
  const listingId = field(formData, "listingId");
  const customerId = asId<"CustomerId">(field(formData, "customerId"));
  const partnerId = field(formData, "partnerId");
  const euros = Number(field(formData, "amountEuros"));
  if (!listingId || !customerId || !partnerId) {
    return { formError: "Choose a listing and a customer first." };
  }
  if (!Number.isFinite(euros) || euros <= 0) {
    return { formError: "Enter an order amount greater than zero." };
  }

  const admin = new NetworkRepository(getSupabaseAdminClient());
  const pseudonymousRef = await admin.resolvePseudonym({
    retailerId: session.retailerId,
    customerId,
    partnerId,
  });
  await network.recordAttributionEvent({
    retailerId: session.retailerId,
    listingId,
    pseudonymousRef,
    event: "order_confirmed",
    providerEventKey: `order_${listingId}_${customerId}_${Date.now()}`,
    valueMinorUnits: Math.round(euros * 100),
  });
  revalidatePath("/network");
  return snapshotAfter({
    network,
    retailerId: session.retailerId,
    listingId,
    pseudonymousRef,
  });
}

export async function refundOrder(
  _previous: NetworkActionState,
  formData: FormData,
): Promise<NetworkActionState> {
  const { session, network } = await context();
  const listingId = field(formData, "listingId");
  const customerId = asId<"CustomerId">(field(formData, "customerId"));
  const partnerId = field(formData, "partnerId");
  if (!listingId || !customerId || !partnerId) {
    return { formError: "Choose a listing and a customer first." };
  }

  const admin = new NetworkRepository(getSupabaseAdminClient());
  const pseudonymousRef = await admin.resolvePseudonym({
    retailerId: session.retailerId,
    customerId,
    partnerId,
  });
  await network.recordAttributionEvent({
    retailerId: session.retailerId,
    listingId,
    pseudonymousRef,
    event: "order_refunded",
    providerEventKey: `refund_${listingId}_${customerId}_${Date.now()}`,
  });
  revalidatePath("/network");
  return snapshotAfter({
    network,
    retailerId: session.retailerId,
    listingId,
    pseudonymousRef,
  });
}
