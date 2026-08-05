import { describe, expect, it } from "vitest";

import { buildChannelContactLinks } from "./communication-channel";

describe("buildChannelContactLinks", () => {
  it("builds real sms/whatsapp/email links from real contact details", () => {
    const links = buildChannelContactLinks({
      phone: "+15551234567",
      email: "client@example.com",
    });
    const byChannel = Object.fromEntries(links.map((l) => [l.channel, l]));
    expect(byChannel["sms"]).toEqual({
      channel: "sms",
      available: true,
      href: "sms:+15551234567",
    });
    expect(byChannel["whatsapp"]).toEqual({
      channel: "whatsapp",
      available: true,
      href: "https://wa.me/15551234567",
    });
    expect(byChannel["email"]).toEqual({
      channel: "email",
      available: true,
      href: "mailto:client@example.com",
    });
  });

  it("marks a channel unavailable with an empty href when there is no real contact detail", () => {
    const links = buildChannelContactLinks({});
    for (const link of links) {
      expect(link.available).toBe(false);
      expect(link.href).toBe("");
    }
  });

  it("only marks email available when only an email is given", () => {
    const links = buildChannelContactLinks({ email: "client@example.com" });
    const byChannel = Object.fromEntries(links.map((l) => [l.channel, l]));
    expect(byChannel["sms"]?.available).toBe(false);
    expect(byChannel["whatsapp"]?.available).toBe(false);
    expect(byChannel["email"]?.available).toBe(true);
  });

  it("encodes a prefill message into the deep link query", () => {
    const links = buildChannelContactLinks({
      phone: "+15551234567",
      email: "client@example.com",
      prefillMessage: "Your linen jackets are in!",
    });
    const byChannel = Object.fromEntries(links.map((l) => [l.channel, l]));
    expect(byChannel["sms"]?.href).toContain("Your%20linen%20jackets");
    expect(byChannel["whatsapp"]?.href).toContain("Your%20linen%20jackets");
    expect(byChannel["email"]?.href).toContain("Your%20linen%20jackets");
  });

  it("strips formatting characters from a phone number for wa.me", () => {
    const links = buildChannelContactLinks({ phone: "+1 (555) 123-4567" });
    const whatsapp = links.find((l) => l.channel === "whatsapp");
    expect(whatsapp?.href).toBe("https://wa.me/15551234567");
  });
});
