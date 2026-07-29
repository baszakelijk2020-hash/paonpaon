import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730110000_add_catalogue_import_publishing.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("catalogue import publishing migration contract", () => {
  it("adds publish attribution columns and transactional publish RPC", () => {
    expect(migration).toContain("published_product_id");
    expect(migration).toContain("publish_error");
    expect(migration).toContain(
      "create or replace function public.publish_catalogue_import_row",
    );
    expect(migration).toContain(
      "create or replace function public.review_catalogue_import_metadata_task",
    );
  });

  it("restricts publish and review RPC execution to authenticated callers", () => {
    expect(migration).toContain(
      "grant execute on function public.publish_catalogue_import_row(uuid)",
    );
    expect(migration).toContain(
      "grant execute on function public.review_catalogue_import_metadata_task",
    );
    expect(migration).toContain("to authenticated, service_role");
  });

  it("requires manager authorization inside publish RPC", () => {
    expect(migration).toContain(
      "public.current_retailer_role() not in ('manager', 'admin', 'owner')",
    );
    expect(migration).toContain("public.current_staff_id()");
  });
});
