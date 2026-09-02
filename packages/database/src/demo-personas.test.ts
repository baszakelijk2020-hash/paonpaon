import { describe, expect, it } from "vitest";

import {
  DEMO_CANONICAL_PERSONAS,
  getDemoPersona,
  isCanonicalDemoEmail,
} from "./demo-seed";

describe("canonical demo personas", () => {
  it("has exactly one launcher identity for every active showcase role", () => {
    expect(DEMO_CANONICAL_PERSONAS).toHaveLength(8);

    const ids = DEMO_CANONICAL_PERSONAS.map((persona) => persona.id);
    const emails = DEMO_CANONICAL_PERSONAS.map((persona) => persona.email);
    const appRolePairs = DEMO_CANONICAL_PERSONAS.map(
      (persona) => `${persona.app}:${persona.role}`,
    );

    expect(new Set(ids)).toHaveLength(ids.length);
    expect(new Set(emails)).toHaveLength(emails.length);
    expect(new Set(appRolePairs)).toHaveLength(appRolePairs.length);
    expect(appRolePairs.sort()).toEqual(
      [
        "admin:platform_admin",
        "customer:customer",
        "retailer:alteration_worker",
        "retailer:production_staff",
        "retailer:retailer_manager",
        "retailer:retailer_owner",
        "retailer:sales_advisor",
        "retailer:workshop_manager",
      ].sort(),
    );
  });

  it("maps every canonical persona to the correct app and showcase tenant", () => {
    expect(getDemoPersona("platform-admin")).toMatchObject({
      app: "admin",
      role: "platform_admin",
      email: "contact+platform-admin@nebelspiegel.com",
    });
    expect(getDemoPersona("customer")).toMatchObject({
      app: "customer",
      role: "customer",
      retailer: "Nebel & Spiegel",
      email: "contact+isabelle@nebelspiegel.com",
    });

    for (const id of [
      "retailer-owner",
      "retailer-manager",
      "sales-advisor",
      "production-staff",
      "workshop-manager",
      "alteration-worker",
    ] as const) {
      expect(getDemoPersona(id)).toMatchObject({
        app: "retailer",
        retailer: "Nebel & Spiegel",
      });
      expect(getDemoPersona(id).email).toMatch(
        /^contact\+atelier-demo-[a-z-]+@nebelspiegel\.com$/,
      );
    }
  });

  it("keeps admin demo toggles scoped to canonical identities", () => {
    expect(isCanonicalDemoEmail("contact+isabelle@nebelspiegel.com")).toBe(
      true,
    );
    expect(isCanonicalDemoEmail("contact+unrelated@nebelspiegel.com")).toBe(
      false,
    );
    expect(isCanonicalDemoEmail("contact+isabelle@example.com")).toBe(false);
    expect(isCanonicalDemoEmail(undefined)).toBe(false);
  });
});
