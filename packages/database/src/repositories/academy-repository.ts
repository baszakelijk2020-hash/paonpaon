/**
 * Staff academy roleplay grading (PHASE 16.1). Thin persistence over
 * `@paon/domain`'s `checkRoleplayGrade` — the schema itself is append-only
 * (`academy_roleplay_grades` has no UPDATE/DELETE grant for any role,
 * including service_role): an editable grade is a grade the trainee
 * cannot rely on.
 */

import {
  checkRoleplayGrade,
  type AcademyRoleplayPersona,
  type RetailerId,
  type RoleplayGradeCheck,
  type RubricEvidence,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type GradeRow = Database["public"]["Tables"]["academy_roleplay_grades"]["Row"];

export interface RoleplayGrade {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly staffId: string;
  readonly lessonKey: string;
  readonly evidence: readonly RubricEvidence[];
  readonly gradedByStaffId: string | null;
  readonly personaKey: AcademyRoleplayPersona | null;
  readonly createdAt: string;
}

function toDomain(row: GradeRow): RoleplayGrade {
  return {
    id: row.id,
    retailerId: row.retailer_id as RetailerId,
    staffId: row.staff_id,
    lessonKey: row.lesson_key,
    evidence: (row.evidence as unknown as RubricEvidence[]) ?? [],
    gradedByStaffId: row.graded_by_staff_id,
    personaKey: row.persona_key as AcademyRoleplayPersona | null,
    createdAt: row.created_at,
  };
}

export type RecordRoleplayGradeResult =
  | { readonly ok: true; readonly grade: RoleplayGrade }
  | Exclude<RoleplayGradeCheck, { readonly ok: true }>
  | { readonly ok: false; readonly reason: "self_grading_not_permitted" };

export class AcademyRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  /**
   * `checkRoleplayGrade` refuses ungrounded feedback before it is ever
   * written. Self-grading is refused here too — the schema's own CHECK
   * constraint would catch it, but a friendly reason beats a raw
   * constraint-violation error reaching the form.
   */
  async recordRoleplayGrade(args: {
    readonly retailerId: RetailerId;
    readonly staffId: string;
    readonly lessonKey: string;
    readonly evidence: readonly RubricEvidence[];
    readonly gradedByStaffId: string;
    readonly personaKey?: AcademyRoleplayPersona;
  }): Promise<RecordRoleplayGradeResult> {
    const check = checkRoleplayGrade({ evidence: args.evidence });
    if (!check.ok) return check;
    if (args.gradedByStaffId === args.staffId) {
      return { ok: false, reason: "self_grading_not_permitted" };
    }

    const { data, error } = await this.client
      .from("academy_roleplay_grades")
      .insert({
        retailer_id: args.retailerId,
        staff_id: args.staffId,
        lesson_key: args.lessonKey.trim(),
        evidence: args.evidence as unknown as Json,
        graded_by_staff_id: args.gradedByStaffId,
        ...(args.personaKey ? { persona_key: args.personaKey } : {}),
      })
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, grade: toDomain(data) };
  }

  async listGradesForStaff(args: {
    readonly retailerId: RetailerId;
    readonly staffId: string;
  }): Promise<readonly RoleplayGrade[]> {
    const { data, error } = await this.client
      .from("academy_roleplay_grades")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("staff_id", args.staffId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toDomain);
  }
}
