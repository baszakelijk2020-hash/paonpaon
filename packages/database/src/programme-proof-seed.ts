/**
 * Ensures the Stage 8.4 linked multi-role proof seed is present and returns
 * canonical appointment/note ids for browser + DB assertions.
 */

import {
  PROGRAMME_PROOF_MARKERS,
  PROGRAMME_PROOF_PERSONAS,
  PROGRAMME_PROOF_RETAILER_SLUG,
  PROGRAMME_PROOF_SEED_ID,
} from "@paon/domain";

import { createSupabaseAdminClient } from "./clients/admin";
import { seedDemoData } from "./demo-seed";

export interface ProgrammeProofSeedResult {
  readonly seedId: typeof PROGRAMME_PROOF_SEED_ID;
  readonly retailerId: string;
  readonly customerId: string;
  readonly appointmentId: string;
  readonly noteId: string;
  readonly appointmentNotes: string;
  readonly noteBody: string;
}

export async function ensureProgrammeProofSeed(params: {
  readonly supabaseUrl: string;
  readonly anonKey: string;
  readonly serviceRoleKey: string;
}): Promise<ProgrammeProofSeedResult> {
  await seedDemoData(params);
  const admin = createSupabaseAdminClient(
    params.supabaseUrl,
    params.serviceRoleKey,
  );

  const { data: retailer, error: retailerError } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", PROGRAMME_PROOF_RETAILER_SLUG)
    .maybeSingle();
  if (retailerError) throw retailerError;
  if (!retailer) {
    throw new Error(
      `Programme proof retailer missing: ${PROGRAMME_PROOF_RETAILER_SLUG}`,
    );
  }

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .select("id, email")
    .eq("retailer_id", retailer.id)
    .eq("email", PROGRAMME_PROOF_PERSONAS.customer.email)
    .is("deleted_at", null)
    .maybeSingle();
  if (customerError) throw customerError;
  if (!customer) {
    throw new Error(
      `Programme proof customer missing: ${PROGRAMME_PROOF_PERSONAS.customer.email}`,
    );
  }

  const { data: appointments, error: appointmentError } = await admin
    .from("appointments")
    .select("id, notes, status, type")
    .eq("retailer_id", retailer.id)
    .eq("customer_id", customer.id)
    .ilike("notes", `%${PROGRAMME_PROOF_MARKERS.appointmentMarker}%`)
    .limit(1);
  if (appointmentError) throw appointmentError;
  const appointment = appointments?.[0];
  if (!appointment) {
    throw new Error(
      `Programme proof appointment missing marker ${PROGRAMME_PROOF_MARKERS.appointmentMarker}`,
    );
  }

  const { data: notes, error: noteError } = await admin
    .from("clienteling_notes")
    .select("id, body")
    .eq("retailer_id", retailer.id)
    .eq("customer_id", customer.id)
    .ilike("body", `%${PROGRAMME_PROOF_MARKERS.pinnedNoteFragment}%`)
    .limit(1);
  if (noteError) throw noteError;
  const note = notes?.[0];
  if (!note) {
    throw new Error(
      `Programme proof note missing fragment ${PROGRAMME_PROOF_MARKERS.pinnedNoteFragment}`,
    );
  }

  return {
    seedId: PROGRAMME_PROOF_SEED_ID,
    retailerId: retailer.id,
    customerId: customer.id,
    appointmentId: appointment.id,
    noteId: note.id,
    appointmentNotes: appointment.notes ?? "",
    noteBody: note.body,
  };
}

/** RLS proof: worker session must not see a note body (AUD-004). */
export async function workerCannotReadClientelingNote(args: {
  readonly supabaseUrl: string;
  readonly anonKey: string;
  readonly workerEmail: string;
  readonly workerPassword: string;
  readonly customerId: string;
  readonly noteBody: string;
}): Promise<boolean> {
  const { createClient } = await import("@supabase/supabase-js");
  const workerClient = createClient(args.supabaseUrl, args.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: authError } = await workerClient.auth.signInWithPassword({
    email: args.workerEmail,
    password: args.workerPassword,
  });
  if (authError) throw authError;
  const { data, error } = await workerClient
    .from("clienteling_notes")
    .select("id, body")
    .eq("customer_id", args.customerId)
    .eq("body", args.noteBody);
  if (error) throw error;
  return (data ?? []).length === 0;
}
