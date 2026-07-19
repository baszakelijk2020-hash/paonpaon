import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260719000103_secure_alterations_and_workflows.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("alterations database security contract", () => {
  it("removes customers from base work-order access and exposes safe projections", () => {
    expect(migration).not.toMatch(
      /create policy [^\n]*customer[^\n]*\n\s*on public\.alteration_work_orders/i,
    );
    expect(migration).toContain(
      "create view public.customer_alteration_work_orders",
    );
    expect(migration).toContain("and h.customer_visible");
    expect(migration).toContain("approval.to_status = 'approved'");
    expect(migration).toContain(
      "grant select on public.customer_alteration_work_orders to authenticated",
    );
  });

  it("narrows inherited tenant access for workshop roles", () => {
    for (const table of [
      "customers",
      "orders",
      "order_lines",
      "appointments",
      "availability_windows",
      "products",
    ]) {
      expect(migration).toMatch(
        new RegExp(`on public\\.${table} as restrictive for select`),
      );
    }
    expect(migration).toContain(
      "t.assigned_worker_id = public.current_staff_id()",
    );
    expect(migration).toContain("a.workshop_id = public.current_workshop_id()");
    expect(migration).toContain("public.worker_alteration_work_orders");
    expect(migration).toContain("public.worker_alteration_tasks");
    expect(migration).toContain("join public.physical_garments g");
    expect(migration).toContain(
      "public.current_retailer_role() <> 'worker' and public.can_access_alteration_work_order",
    );
  });

  it("keeps sensitive history append-only and transition-driven", () => {
    expect(migration).toContain(
      "enforce_work_order_status_via_history_on_update",
    );
    expect(migration).toContain("Invalid alteration transition");
    expect(migration).not.toMatch(
      /on public\.alteration_status_history for (update|delete|all)/,
    );
    expect(migration).not.toMatch(
      /on public\.alteration_pricing_history for (update|delete|all)/,
    );
    expect(migration).toContain(
      "Every work-now task must be review-ready before completion review",
    );
    expect(migration).toContain(
      "Verified pickup or delivery completion is required",
    );
    expect(migration).toContain("The original work-order quote is immutable");
    expect(migration).toContain(
      "Alteration task scope and original quote are immutable",
    );
  });

  it("synchronizes worker scope and validates releases at the database boundary", () => {
    expect(migration).toContain("public.update_workshop_assignment");
    expect(migration).toContain("replaced worker immediately loses access");
    expect(migration).not.toContain(
      'create policy "assigned workshop managers can update assignment dates and workers"',
    );
    expect(migration).toContain(
      "enforce_alteration_custody_workflow_on_insert",
    );
    expect(migration).toContain(
      "enforce_alteration_fulfillment_workflow_on_insert",
    );
    expect(migration).toContain("public.add_alteration_task_note");
    expect(migration).toContain(
      "Attachment path must be scoped to its retailer and work order",
    );
    expect(migration).not.toContain(
      'create policy "management can manage retailer price list items"',
    );
  });
});
