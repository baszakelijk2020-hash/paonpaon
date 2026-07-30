import { describe, expect, it } from "vitest";

import {
  cloneLibrarySnapshotForRetailer,
  emptyPrerequisitesBlockActivation,
  MEMBER_FABRIC_LIBRARY_V1,
  pinnedCopySurvivesLibraryPublish,
} from "./campaign-library";

describe("campaign library", () => {
  it("clones a library snapshot for a retailer copy without losing pin label", () => {
    const copy = cloneLibrarySnapshotForRetailer(MEMBER_FABRIC_LIBRARY_V1);
    expect(copy.kind).toBe("private_offer");
    expect(copy.pinnedVersionLabel).toBe(MEMBER_FABRIC_LIBRARY_V1.versionLabel);
  });

  it("keeps pinned copies stable when a newer library version is published", () => {
    const v2 = {
      ...MEMBER_FABRIC_LIBRARY_V1,
      versionLabel: "private-offer-member-fabric-v2",
      title: "Updated member fabric offer",
    };
    expect(
      pinnedCopySurvivesLibraryPublish({
        pinnedSnapshot: MEMBER_FABRIC_LIBRARY_V1,
        newLibrarySnapshot: v2,
      }),
    ).toBe(true);
    expect(MEMBER_FABRIC_LIBRARY_V1.title).toBe("Member fabric private offer");
    expect(v2.title).not.toBe(MEMBER_FABRIC_LIBRARY_V1.title);
  });

  it("blocks activation when prerequisites are empty/unsatisfied", () => {
    const missing = emptyPrerequisitesBlockActivation(
      MEMBER_FABRIC_LIBRARY_V1,
      new Set(["personalization_consent"]),
    );
    expect(missing).toContain("active_catalogue_products");
    expect(missing).toContain("advisor_coverage");
  });
});
