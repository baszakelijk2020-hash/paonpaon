import { describe, expect, it } from "vitest";

import {
  decodeProspectProductImageLine,
  encodeProspectProductImageLine,
  formatProspectProductImageLine,
} from "./commercial-prospect";

describe("prospect product image lines", () => {
  it("round-trips optional name and description through the URL hash", () => {
    const stored = encodeProspectProductImageLine({
      url: "https://cdn.example.com/jacket.webp",
      name: "Midnight dinner jacket",
      description: "Evening formal",
    });
    expect(stored.startsWith("https://cdn.example.com/jacket.webp")).toBe(true);
    const decoded = decodeProspectProductImageLine(stored);
    expect(decoded.url).toBe("https://cdn.example.com/jacket.webp");
    expect(decoded.name).toBe("Midnight dinner jacket");
    expect(decoded.description).toBe("Evening formal");
    expect(formatProspectProductImageLine(stored)).toBe(
      "https://cdn.example.com/jacket.webp | Midnight dinner jacket | Evening formal",
    );
  });

  it("parses Studio pipe lines before save", () => {
    const decoded = decodeProspectProductImageLine(
      "https://cdn.example.com/a.webp | Soft flannel | Autumn",
    );
    expect(decoded.name).toBe("Soft flannel");
    expect(decoded.description).toBe("Autumn");
  });
});
