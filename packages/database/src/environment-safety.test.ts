import { describe, expect, it } from "vitest";

import {
  assertSafeSupabaseWriteTarget,
  supabaseProjectRef,
} from "./environment-safety";

describe("Supabase write-target safety", () => {
  it.each([
    "http://127.0.0.1:54321",
    "http://localhost:54321",
    "http://[::1]:54321",
  ])("permits local Supabase at %s", (supabaseUrl) => {
    expect(
      assertSafeSupabaseWriteTarget({
        supabaseUrl,
        operation: "e2e",
      }),
    ).toEqual({ kind: "local", projectRef: null });
  });

  it("permits a hosted project only when explicitly classified disposable", () => {
    expect(
      assertSafeSupabaseWriteTarget({
        supabaseUrl: "https://lowlzpktpayiglckvfpi.supabase.co",
        operation: "integration test",
        disposableProjectRefs: "lowlzpktpayiglckvfpi",
      }),
    ).toEqual({
      kind: "allowlisted_disposable",
      projectRef: "lowlzpktpayiglckvfpi",
    });
  });

  it("refuses an unidentified hosted project by default", () => {
    expect(() =>
      assertSafeSupabaseWriteTarget({
        supabaseUrl: "https://lowlzpktpayiglckvfpi.supabase.co",
        operation: "integration test",
      }),
    ).toThrow(/not explicitly allowlisted/u);
  });

  it("always refuses the original project even if a caller allowlists it", () => {
    expect(() =>
      assertSafeSupabaseWriteTarget({
        supabaseUrl: "https://hngxrczavwywsnfceppb.supabase.co",
        operation: "e2e",
        disposableProjectRefs: "hngxrczavwywsnfceppb",
      }),
    ).toThrow(/protected original\/production/u);
  });

  it("refuses non-Supabase remote hosts", () => {
    expect(() =>
      assertSafeSupabaseWriteTarget({
        supabaseUrl: "https://database.example.com",
        operation: "e2e",
        disposableProjectRefs: "database",
      }),
    ).toThrow(/not a local or identifiable hosted Supabase target/u);
  });

  it("extracts only canonical hosted project refs", () => {
    expect(supabaseProjectRef("https://lowlzpktpayiglckvfpi.supabase.co")).toBe(
      "lowlzpktpayiglckvfpi",
    );
    expect(supabaseProjectRef("http://127.0.0.1:54321")).toBeNull();
  });
});
