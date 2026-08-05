/**
 * Omnichannel communication hub — provider-neutral core (ADV-109 /
 * PHASE 17.9).
 *
 * The whole item's real constraint: PAON has no live SMS/WhatsApp/email
 * *sending* provider configured (Twilio, WhatsApp Business API, an
 * email provider all need real accounts and keys — genuinely
 * `blocked_external`, not attempted here). What is buildable today with
 * zero credentials is the other half of "omnichannel": a deep link that
 * opens the *advisor's own device's native app* for that channel,
 * pre-filled, so no message is ever sent by PAON on the retailer's
 * behalf — the advisor sends it themselves, from their own number/
 * account, exactly as if they had typed the address by hand. This file
 * is the one place that builds those links — every surface that offers
 * "text this customer" reuses it, never a second ad-hoc `mailto:`.
 */

export const ADVISOR_CONTACT_CHANNELS = ["sms", "whatsapp", "email"] as const;
export type AdvisorContactChannel = (typeof ADVISOR_CONTACT_CHANNELS)[number];

export const ADVISOR_CONTACT_CHANNEL_LABELS: Record<
  AdvisorContactChannel,
  string
> = {
  sms: "Text",
  whatsapp: "WhatsApp",
  email: "Email",
};

export interface ChannelContactLink {
  readonly channel: AdvisorContactChannel;
  /** Empty when `available` is false — never a fabricated link with no
   * real contact detail behind it. */
  readonly href: string;
  readonly available: boolean;
}

function digitsOnly(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

/**
 * Builds one deep link per channel from the customer's own real contact
 * details — `available: false` (empty href) for any channel the
 * customer has no real detail for, rather than guessing or omitting the
 * channel entirely, so a caller can render a consistent disabled state
 * instead of a layout that shifts per customer.
 */
export function buildChannelContactLinks(args: {
  readonly phone?: string;
  readonly email?: string;
  readonly prefillMessage?: string;
}): readonly ChannelContactLink[] {
  const prefill = args.prefillMessage?.trim()
    ? encodeURIComponent(args.prefillMessage.trim())
    : "";
  const phoneDigits = args.phone?.trim() ? digitsOnly(args.phone) : "";
  const email = args.email?.trim() ?? "";

  return [
    {
      channel: "sms",
      available: phoneDigits.length > 0,
      href: phoneDigits
        ? `sms:${phoneDigits}${prefill ? `?&body=${prefill}` : ""}`
        : "",
    },
    {
      channel: "whatsapp",
      available: phoneDigits.length > 0,
      href: phoneDigits
        ? `https://wa.me/${phoneDigits.replace(/^\+/, "")}${prefill ? `?text=${prefill}` : ""}`
        : "",
    },
    {
      channel: "email",
      available: email.length > 0,
      href: email ? `mailto:${email}${prefill ? `?body=${prefill}` : ""}` : "",
    },
  ];
}
