import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { nextYearlyOccurrence } from "../appointments/customer-moment";

import {
  checkDesignCoherence,
  checkGroupFittingCapacity,
  checkGuestVoucher,
  nextAnniversary,
  summarizeGroupReadiness,
} from "./moonstruck-pack";

describe("no second party model", () => {
  it("defines no party or member type of its own", () => {
    // The owner boundary says "never create a second party model".
    // public.wedding_parties and wedding_party_members already exist with
    // roles, invites, fitting states and RLS; this module extends that
    // aggregate rather than shadowing it.
    const rawSource = readFileSync(
      new URL("./moonstruck-pack.ts", import.meta.url),
      "utf8",
    );
    // Declarations are scanned with comments stripped; the provenance
    // assertion below reads the raw source, because the thing it is
    // checking for IS a comment.
    const source = rawSource.replace(/\/\*[\s\S]*?\*\//g, "");
    const declarations = [
      ...source.matchAll(/export (?:interface|type|class) (\w+)/g),
    ].map((match) => match[1]!);
    // The forbidden shape is an ENTITY that shadows the existing rows -
    // WeddingParty, PartyMember, WeddingPartyMember. Not every name
    // containing "Party": PartyReadinessState is a state enum and
    // MemberReadiness is a projection keyed by the EXISTING member id,
    // which the type's own comment states. A blunter regex flagged both
    // and would have pushed this module toward worse names to satisfy a
    // test rather than the rule the test is for.
    expect(
      declarations.filter((name) =>
        /^(Wedding)?Party(Member)?$|^PartyMember$|^WeddingPartyMember$/.test(
          name,
        ),
      ),
    ).toEqual([]);
    expect(rawSource).toContain("wedding_party_members.id");
  });
});

describe("summarizeGroupReadiness", () => {
  const members = [
    { memberId: "m1", displayName: "Groom", state: "fitted" as const },
    { memberId: "m2", displayName: "Best man", state: "measured" as const },
    { memberId: "m3", displayName: "Usher", state: "invited" as const },
  ];

  it("names who is blocking without exposing any measurement", () => {
    // A best man must not read the groom's waist because they are in the
    // same party.
    const readiness = summarizeGroupReadiness({
      members,
      eventDate: "2026-09-01T00:00:00.000Z",
      asOf: "2026-08-01T00:00:00.000Z",
    });
    // 31 days out the required milestone is "ordered", so the best man
    // sitting at "measured" is behind too. My first draft of this test
    // expected only the usher; the code was right and the test was wrong —
    // garments have to be ordered roughly eight weeks out, and a party
    // member who is merely measured a month before the date is exactly the
    // person a planner needs to chase.
    expect(readiness.blockingMemberNames).toEqual(["Best man", "Usher"]);
    expect(readiness.onTrack).toBe(false);
    expect(JSON.stringify(readiness)).not.toMatch(
      /chest|waist|inseam|millimetres|size/i,
    );
  });

  it("counts every state, including the ones nobody is in", () => {
    const readiness = summarizeGroupReadiness({
      members,
      eventDate: "2026-09-01T00:00:00.000Z",
      asOf: "2026-08-01T00:00:00.000Z",
    });
    expect(readiness.byState.collected).toBe(0);
    expect(readiness.byState.fitted).toBe(1);
    expect(readiness.memberCount).toBe(3);
  });

  it("tightens the required milestone as the date approaches", () => {
    // Same party, five days out instead of thirty-one: everyone who has
    // not collected is now blocking.
    const readiness = summarizeGroupReadiness({
      members,
      eventDate: "2026-09-01T00:00:00.000Z",
      asOf: "2026-08-28T00:00:00.000Z",
    });
    expect(readiness.blockingMemberNames).toEqual([
      "Best man",
      "Groom",
      "Usher",
    ]);
  });

  it("is on track when everyone has cleared the milestone", () => {
    const readiness = summarizeGroupReadiness({
      members: [{ memberId: "m1", displayName: "Groom", state: "collected" }],
      eventDate: "2026-09-01T00:00:00.000Z",
      asOf: "2026-08-28T00:00:00.000Z",
    });
    expect(readiness.onTrack).toBe(true);
  });
});

describe("checkGroupFittingCapacity", () => {
  it("answers the question that actually goes wrong", () => {
    // Eight groomsmen, one fitter, three weeks. Answering late is what
    // turns a wedding into a complaint.
    expect(
      checkGroupFittingCapacity({
        memberCount: 8,
        fittingsPerDay: 2,
        availableDaysBeforeEvent: 21,
      }),
    ).toEqual({ ok: true, sessionsRequired: 4 });
  });

  it("refuses a party that cannot physically be fitted in time", () => {
    expect(
      checkGroupFittingCapacity({
        memberCount: 8,
        fittingsPerDay: 1,
        availableDaysBeforeEvent: 3,
      }),
    ).toEqual({ ok: false, reason: "party_exceeds_capacity_before_event" });
  });

  it("refuses when the event has already passed", () => {
    expect(
      checkGroupFittingCapacity({
        memberCount: 1,
        fittingsPerDay: 2,
        availableDaysBeforeEvent: -1,
      }),
    ).toEqual({ ok: false, reason: "event_in_the_past" });
  });

  it("refuses when no fitting capacity is configured", () => {
    expect(
      checkGroupFittingCapacity({
        memberCount: 1,
        fittingsPerDay: 0,
        availableDaysBeforeEvent: 30,
      }),
    ).toEqual({ ok: false, reason: "no_capacity_configured" });
  });
});

describe("checkDesignCoherence", () => {
  it("catches two different lapels before the morning of the wedding", () => {
    expect(
      checkDesignCoherence({
        choicesByMember: [
          {
            memberId: "m1",
            choices: [
              { slotKey: "lapel", valueKey: "peak", coordinated: true },
            ],
          },
          {
            memberId: "m2",
            choices: [
              { slotKey: "lapel", valueKey: "notch", coordinated: true },
            ],
          },
        ],
      }),
    ).toEqual({
      ok: false,
      reason: "coordinated_slot_has_conflicting_values",
      slotKey: "lapel",
    });
  });

  it("allows per-person choices to differ", () => {
    expect(
      checkDesignCoherence({
        choicesByMember: [
          {
            memberId: "m1",
            choices: [
              { slotKey: "lapel", valueKey: "peak", coordinated: true },
              { slotKey: "trouser_length", valueKey: "32", coordinated: false },
            ],
          },
          {
            memberId: "m2",
            choices: [
              { slotKey: "lapel", valueKey: "peak", coordinated: true },
              { slotKey: "trouser_length", valueKey: "30", coordinated: false },
            ],
          },
        ],
      }),
    ).toEqual({ ok: true });
  });
});

describe("checkGuestVoucher", () => {
  const base = {
    valueMinorUnits: 5000,
    expiresOn: "2027-01-01",
    fundingSource: "retailer_margin",
    createsCustomerRecords: false,
  };

  it("issues a funded, expiring voucher", () => {
    expect(checkGuestVoucher(base)).toEqual({ ok: true });
  });

  it("refuses to turn a guest list into a customer import", () => {
    // The couple shared those names to organise a wedding, not to populate
    // a CRM.
    expect(
      checkGuestVoucher({ ...base, createsCustomerRecords: true }),
    ).toEqual({ ok: false, reason: "guest_list_not_a_customer_import" });
  });

  it("refuses an unfunded or unexpiring voucher", () => {
    const { fundingSource: _f, ...unfunded } = base;
    expect(checkGuestVoucher(unfunded)).toEqual({
      ok: false,
      reason: "funding_source_required",
    });
    const { expiresOn: _e, ...noExpiry } = base;
    expect(checkGuestVoucher(noExpiry)).toEqual({
      ok: false,
      reason: "expiry_required",
    });
  });
});

describe("nextAnniversary", () => {
  it("reuses the existing yearly recurrence rather than writing a second one", () => {
    // A second date-recurrence function is exactly how two parts of a
    // system start disagreeing about what a leap-year date means.
    const moment = nextAnniversary({
      eventDate: "2024-09-14",
      asOf: "2026-08-01",
      nextYearlyOccurrence,
    });
    expect(moment.occursOn).toBe("2026-09-14");
    expect(moment.yearsSince).toBe(2);
  });

  it("rolls to next year once the date has passed", () => {
    const moment = nextAnniversary({
      eventDate: "2024-03-02",
      asOf: "2026-08-01",
      nextYearlyOccurrence,
    });
    expect(moment.occursOn).toBe("2027-03-02");
    expect(moment.yearsSince).toBe(3);
  });

  it("reports zero years since on the wedding day itself, before the first anniversary", () => {
    // The UI callers (retailer and customer wedding-party pages) branch on
    // yearsSince > 0 to say "your wedding day" instead of "N years married"
    // — this locks that this is the real first-year value, not undefined
    // or negative.
    const moment = nextAnniversary({
      eventDate: "2026-08-01",
      asOf: "2026-08-01",
      nextYearlyOccurrence,
    });
    expect(moment.occursOn).toBe("2026-08-01");
    expect(moment.yearsSince).toBe(0);
  });
});
