import type { Order } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { formatMoney } from "@paon/utils";

import { ChannelContactButtons } from "../../channel-contact-buttons";

/**
 * Ambient/frictionless checkout's provider-neutral core (PHASE 17.12 /
 * ADV-112): the customer's own real, server-persisted cart (`orders`
 * status `draft` — already digital-to-physical, no new persistence
 * needed) with a real deep link into it, sent via the advisor's own
 * device (reuses `ChannelContactButtons`/17.9's channel links, never a
 * second ad-hoc link builder). Checkout as a gesture inside the
 * conversation, not a separate register event. Real payment capture is
 * `blocked_external` on ADR-062 (13.3) — the customer completes payment
 * on their own device via the storefront's existing checkout, unchanged
 * by this card.
 */
export function CartSoftCloseCard({
  cart,
  lineCount,
  customerAppUrl,
  phone,
  email,
}: {
  readonly cart: Order;
  readonly lineCount: number;
  readonly customerAppUrl: string;
  readonly phone?: string;
  readonly email?: string;
}) {
  return (
    <Card className="flex flex-col gap-3" data-cart-soft-close-card>
      <div>
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Cart ready to send
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          {lineCount} {lineCount === 1 ? "item" : "items"} ·{" "}
          {formatMoney(cart.total, "en-US")} · send a review link to their own
          device instead of ringing it up on the floor.
        </p>
      </div>
      <ChannelContactButtons
        {...(phone ? { phone } : {})}
        {...(email ? { email } : {})}
        prefillMessage={`Here's your cart, ready to review and complete: ${customerAppUrl}`}
      />
    </Card>
  );
}
