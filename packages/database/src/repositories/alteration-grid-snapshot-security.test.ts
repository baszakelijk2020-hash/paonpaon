import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../../../supabase/migrations/20260814000000_add_ft04_alteration_grid_snapshots.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("FT-04 alteration grid migration", () => {
  it("makes snapshots append-only and revision-authorized", () => {
    expect(migration).toContain("alteration_grid_snapshots_immutable");
    expect(migration).toContain("Alteration grid snapshots are immutable");
    expect(migration).toContain(
      "if v_version > 1 and not public.is_alterations_management()",
    );
  });

  it("derives ownership and refuses unpriced or zero-value dispatch", () => {
    expect(migration).toContain("v_order.retailer_id, v_order.customer_id");
    expect(migration).toContain("Only non-zero grid values may be dispatched");
    expect(migration).toContain(
      "No active fixed price exists for selected alteration",
    );
    expect(migration).toContain("Duplicate operations are not allowed");
  });
});
