import { describe, expect, it } from "vitest";

import { createClientelingNoteSchema } from "./clienteling.schema";
describe("createClientelingNoteSchema", () => {
  it("accepts a private note", () => {
    expect(
      createClientelingNoteSchema.safeParse({
        customerId: "11111111-1111-1111-1111-111111111111",
        body: "Prefers quiet morning appointments",
        pinned: true,
        visibility: "assigned_advisor",
      }).success,
    ).toBe(true);
  });
  it("rejects an empty note", () => {
    expect(
      createClientelingNoteSchema.safeParse({
        customerId: "11111111-1111-1111-1111-111111111111",
        body: "",
        pinned: false,
        visibility: "assigned_advisor",
      }).success,
    ).toBe(false);
  });
  it("rejects an unrecognized visibility tier", () => {
    expect(
      createClientelingNoteSchema.safeParse({
        customerId: "11111111-1111-1111-1111-111111111111",
        body: "Prefers quiet morning appointments",
        pinned: false,
        visibility: "everyone",
      }).success,
    ).toBe(false);
  });
});
