import { describe, expect, it } from "vitest";

import {
  canCustomerConfirmSilhouetteAnalysisCandidate,
  canWithdrawSilhouetteAnalysisConsent,
  isSilhouetteAnalysisSessionTerminal,
} from "./silhouette-analysis";

describe("isSilhouetteAnalysisSessionTerminal", () => {
  it("is false for every non-terminal status", () => {
    expect(isSilhouetteAnalysisSessionTerminal("consented")).toBe(false);
    expect(isSilhouetteAnalysisSessionTerminal("capturing")).toBe(false);
    expect(isSilhouetteAnalysisSessionTerminal("candidate")).toBe(false);
    expect(isSilhouetteAnalysisSessionTerminal("advisor_reviewed")).toBe(false);
  });

  it("is true for every terminal status", () => {
    expect(isSilhouetteAnalysisSessionTerminal("customer_confirmed")).toBe(
      true,
    );
    expect(isSilhouetteAnalysisSessionTerminal("rejected")).toBe(true);
    expect(isSilhouetteAnalysisSessionTerminal("expired")).toBe(true);
  });
});

describe("canWithdrawSilhouetteAnalysisConsent", () => {
  it("allows withdrawal from any non-terminal status", () => {
    expect(canWithdrawSilhouetteAnalysisConsent("consented")).toBe(true);
    expect(canWithdrawSilhouetteAnalysisConsent("capturing")).toBe(true);
    expect(canWithdrawSilhouetteAnalysisConsent("candidate")).toBe(true);
    expect(canWithdrawSilhouetteAnalysisConsent("advisor_reviewed")).toBe(true);
  });

  it("refuses withdrawal once a terminal status is reached", () => {
    expect(canWithdrawSilhouetteAnalysisConsent("customer_confirmed")).toBe(
      false,
    );
    expect(canWithdrawSilhouetteAnalysisConsent("rejected")).toBe(false);
    expect(canWithdrawSilhouetteAnalysisConsent("expired")).toBe(false);
  });
});

describe("canCustomerConfirmSilhouetteAnalysisCandidate", () => {
  it("allows confirmation only when advisor_reviewed and approved", () => {
    expect(
      canCustomerConfirmSilhouetteAnalysisCandidate(
        "advisor_reviewed",
        "approved",
      ),
    ).toBe(true);
  });

  it("refuses confirmation when the advisor rejected", () => {
    expect(
      canCustomerConfirmSilhouetteAnalysisCandidate(
        "advisor_reviewed",
        "rejected",
      ),
    ).toBe(false);
  });

  it("refuses confirmation before advisor review", () => {
    expect(
      canCustomerConfirmSilhouetteAnalysisCandidate("candidate", undefined),
    ).toBe(false);
  });

  it("refuses confirmation after the session is already terminal", () => {
    expect(
      canCustomerConfirmSilhouetteAnalysisCandidate(
        "customer_confirmed",
        "approved",
      ),
    ).toBe(false);
  });
});
