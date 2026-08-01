import { describe, expect, it } from "vitest";

import {
  normalizePinterestUrl,
  safeAttachmentFileName,
  validateMessageAttachmentUpload,
} from "./messaging";

describe("consultation attachments", () => {
  it("accepts a real PNG signature and sanitizes its name", () => {
    expect(
      validateMessageAttachmentUpload({
        purpose: "wedding_fabric",
        fileName: "../swatch ♥.png",
        mimeType: "image/png",
        sizeBytes: 8,
        bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      }),
    ).toEqual({
      ok: true,
      fileName: "swatch -.png",
      mimeType: "image/png",
    });
  });

  it("rejects extension/MIME spoofing and purpose mismatches", () => {
    expect(
      validateMessageAttachmentUpload({
        purpose: "photo",
        fileName: "look.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 5,
        bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      }),
    ).toEqual({
      ok: false,
      error: "File contents do not match the declared type.",
    });
    expect(
      validateMessageAttachmentUpload({
        purpose: "photo",
        fileName: "brief.pdf",
        mimeType: "application/pdf",
        sizeBytes: 5,
        bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      }),
    ).toEqual({
      ok: false,
      error: "That file type does not match its purpose.",
    });
  });

  it("normalizes only HTTPS Pinterest references", () => {
    expect(
      normalizePinterestUrl("https://www.pinterest.com/pin/123#detail"),
    ).toBe("https://www.pinterest.com/pin/123");
    expect(normalizePinterestUrl("https://pin.it/abc")).toBe(
      "https://pin.it/abc",
    );
    expect(normalizePinterestUrl("http://pinterest.com/pin/123")).toBeNull();
    expect(
      normalizePinterestUrl("https://pinterest.com.evil.test/pin"),
    ).toBeNull();
  });

  it("removes path traversal from names", () => {
    expect(safeAttachmentFileName("C:\\fakepath\\look.png")).toBe("look.png");
  });
});
