import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import {
  RetailerStaffRepository,
  StaffEmailAlreadyInvitedError,
} from "./retailer-staff-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type RetailerStaffRow =
  Database["public"]["Tables"]["retailer_staff_members"]["Row"];

const row: RetailerStaffRow = {
  id: "22222222-2222-2222-2222-222222222222",
  retailer_id: "11111111-1111-1111-1111-111111111111",
  user_id: "33333333-3333-3333-3333-333333333333",
  full_name: "Owner Ownerson",
  email: "owner@atelier.com",
  role: "owner",
  workshop_id: null,
  invited_at: "2026-01-01T00:00:00.000Z",
  accepted_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
};

function clientReturning(result: {
  data: unknown;
  error: unknown;
}): PaonSupabaseClient {
  return {
    from: () => fakeQueryBuilder(result as never),
  } as unknown as PaonSupabaseClient;
}

describe("RetailerStaffRepository", () => {
  it("maps a row to a domain RetailerStaffMember, omitting a null acceptedAt", async () => {
    const repo = new RetailerStaffRepository(
      clientReturning({ data: row, error: null }),
    );
    const staff = await repo.findByUserId(row.user_id as never);

    expect(staff).not.toBeNull();
    expect(staff?.fullName).toBe("Owner Ownerson");
    expect("acceptedAt" in (staff ?? {})).toBe(false);
  });

  it("returns null when no staff row is found", async () => {
    const repo = new RetailerStaffRepository(
      clientReturning({ data: null, error: null }),
    );
    const staff = await repo.findByUserId("missing" as never);
    expect(staff).toBeNull();
  });

  it("maps a list of rows in findByRetailer()", async () => {
    const repo = new RetailerStaffRepository(
      clientReturning({ data: [row], error: null }),
    );
    const staff = await repo.findByRetailer(row.retailer_id as never);
    expect(staff).toHaveLength(1);
    expect(staff[0]?.role).toBe("owner");
  });

  it("throws StaffEmailAlreadyInvitedError on a unique constraint violation", async () => {
    const repo = new RetailerStaffRepository(
      clientReturning({
        data: null,
        error: { code: "23505", message: "duplicate" },
      }),
    );

    await expect(
      repo.create({
        retailerId: row.retailer_id as never,
        userId: row.user_id as never,
        fullName: row.full_name,
        email: row.email,
        role: "owner",
      }),
    ).rejects.toBeInstanceOf(StaffEmailAlreadyInvitedError);
  });

  it("acceptInvite calls the accept_retailer_staff_invite RPC with the staff id", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = { rpc } as unknown as PaonSupabaseClient;
    const repo = new RetailerStaffRepository(client);

    await repo.acceptInvite(row.id as never);

    expect(rpc).toHaveBeenCalledWith("accept_retailer_staff_invite", {
      p_staff_id: row.id,
    });
  });

  it("acceptInvite rejects when the RPC errors", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: new Error("not authorized") });
    const client = { rpc } as unknown as PaonSupabaseClient;
    const repo = new RetailerStaffRepository(client);

    await expect(repo.acceptInvite(row.id as never)).rejects.toBeTruthy();
  });
});
