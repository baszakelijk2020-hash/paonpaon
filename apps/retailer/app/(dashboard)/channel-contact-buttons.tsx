import {
  ADVISOR_CONTACT_CHANNEL_LABELS,
  buildChannelContactLinks,
} from "@paon/domain";

/**
 * PHASE 17.9: the one shared surface every "contact this customer"
 * button reuses — SMS/WhatsApp/Email deep links into the advisor's own
 * device, never a second ad-hoc `mailto:` scattered across pages.
 * Unavailable channels render disabled rather than being hidden, so the
 * set of options never silently shifts per customer.
 */
const TONE_CLASSES = {
  light: {
    available:
      "border-[var(--color-stone-200)] hover:bg-[var(--color-stone-50)] hover:underline",
    unavailable:
      "border-dashed border-[var(--color-stone-200)] text-[var(--color-stone-400)]",
  },
  dark: {
    available: "border-white/30 text-white hover:bg-white/10 hover:underline",
    unavailable: "border-dashed border-white/20 text-white/40",
  },
} as const;

export function ChannelContactButtons({
  phone,
  email,
  prefillMessage,
  tone = "light",
  className,
}: {
  readonly phone?: string;
  readonly email?: string;
  readonly prefillMessage?: string;
  readonly tone?: "light" | "dark";
  readonly className?: string;
}) {
  const links = buildChannelContactLinks({
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    ...(prefillMessage ? { prefillMessage } : {}),
  });
  const toneClasses = TONE_CLASSES[tone];

  return (
    <div
      data-channel-contact-buttons
      className={`flex flex-wrap gap-2 ${className ?? ""}`}
    >
      {links.map((link) =>
        link.available ? (
          <a
            key={link.channel}
            href={link.href}
            data-channel={link.channel}
            className={`rounded-[var(--radius-md)] border px-3 py-1.5 text-xs underline-offset-4 ${toneClasses.available}`}
          >
            {ADVISOR_CONTACT_CHANNEL_LABELS[link.channel]}
          </a>
        ) : (
          <span
            key={link.channel}
            data-channel={link.channel}
            className={`rounded-[var(--radius-md)] border px-3 py-1.5 text-xs ${toneClasses.unavailable}`}
          >
            {ADVISOR_CONTACT_CHANNEL_LABELS[link.channel]}
          </span>
        ),
      )}
    </div>
  );
}
