import { requireRetailerRole } from "@paon/auth";
import {
  GiftRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
} from "@paon/database";
import {
  GIFT_EXPERIENCE_STATUS_LABELS,
  GIFT_INVITATION_STATUS_LABELS,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { Input } from "@paon/ui/components/Input";
import { formatMoney } from "@paon/utils";
import { redirect } from "next/navigation";

import {
  composeGiftExperience,
  emailGiftInvitation,
  revokeGiftExperience,
  sendGiftInvitation,
} from "./actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function GiftsPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "manager");
  } catch {
    redirect("/dashboard");
  }

  const supabase = await getSupabaseServerClient();
  const giftRepo = new GiftRepository(supabase);
  const retailer = await new RetailerRepository(supabase).findById(
    session.retailerId,
  );
  const products = (
    await new ProductRepository(supabase).findByRetailer(session.retailerId)
  ).filter((product) => product.status === "active");
  const variantsByProduct = await Promise.all(
    products.map((product) =>
      new ProductVariantRepository(supabase).findByProduct(product.id),
    ),
  );

  const experiences = await giftRepo.findExperiencesByRetailer(
    session.retailerId,
  );
  const experienceDetails = await Promise.all(
    experiences.map(async (experience) => ({
      experience,
      items: await giftRepo.findCuratedItems(experience.id),
      invitations: await giftRepo.findInvitationsByExperience(experience.id),
    })),
  );

  const customerAppBase = (
    process.env["NEXT_PUBLIC_CUSTOMER_APP_URL"] ?? "http://localhost:3002"
  ).replace(/\/$/, "");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Gifts</h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Curate a small selection of real pieces and send a private invitation
          — the recipient chooses what to reveal.
        </p>
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-medium">Curate a gift experience</h2>
        <form action={composeGiftExperience} className="flex flex-col gap-4">
          <Input name="title" placeholder="A little something" required />
          <textarea
            name="introMessage"
            className="min-h-24 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3"
            placeholder="A short note the recipient sees when they open it"
            required
          />
          <Input name="expiresAt" type="date" aria-label="Expires (optional)" />
          <fieldset className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3">
            <legend className="px-1 text-sm font-medium">
              Choose 1–12 pieces
            </legend>
            <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
              {products.flatMap((product, productIndex) =>
                (variantsByProduct[productIndex] ?? []).map((variant) => (
                  <label
                    key={variant.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="productVariantIds"
                      value={variant.id}
                    />
                    {product.name}
                    {variant.size || variant.color
                      ? ` · ${[variant.size, variant.color].filter(Boolean).join(" · ")}`
                      : ""}
                    {" — "}
                    {formatMoney(variant.price, "en-US")}
                  </label>
                )),
              )}
              {products.length === 0 ? (
                <p className="text-sm text-[var(--color-stone-500)]">
                  Add an active product to the catalogue first.
                </p>
              ) : null}
            </div>
          </fieldset>
          <Button type="submit">Create gift experience</Button>
        </form>
      </Card>

      <div className="flex flex-col gap-6">
        {experienceDetails.map(({ experience, items, invitations }) => (
          <Card key={experience.id} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{experience.title}</p>
                <p className="text-sm text-[var(--color-stone-500)]">
                  {experience.introMessage}
                </p>
              </div>
              <span className="shrink-0 text-sm">
                {GIFT_EXPERIENCE_STATUS_LABELS[experience.status]}
              </span>
            </div>
            <p className="text-xs text-[var(--color-stone-500)]">
              {items.length} curated {items.length === 1 ? "piece" : "pieces"}
              {experience.expiresAt
                ? ` · expires ${new Date(experience.expiresAt).toLocaleDateString("en-US")}`
                : ""}
            </p>

            <form action={sendGiftInvitation} className="flex flex-wrap gap-2">
              <input
                type="hidden"
                name="giftExperienceId"
                value={experience.id}
              />
              <Input
                name="recipientName"
                placeholder="Recipient name (optional)"
                className="w-auto"
              />
              <Input
                name="recipientEmail"
                type="email"
                placeholder="Recipient email (optional)"
                className="w-auto"
              />
              <Button type="submit" variant="secondary" size="sm">
                Send invitation
              </Button>
            </form>

            {invitations.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {invitations.map((invitation) => (
                  <li
                    key={invitation.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      {invitation.recipientName ??
                        invitation.recipientEmail ??
                        "Unnamed recipient"}
                      {" — "}
                      {GIFT_INVITATION_STATUS_LABELS[invitation.status]}
                    </span>
                    <code className="truncate text-xs text-[var(--color-stone-500)]">
                      {customerAppBase}/r/{retailer?.slug}/gift/
                      {invitation.inviteToken}
                    </code>
                    {invitation.recipientEmail ? (
                      <form action={emailGiftInvitation}>
                        <input
                          type="hidden"
                          name="invitationId"
                          value={invitation.id}
                        />
                        <Button type="submit" variant="outline" size="sm">
                          {invitation.emailSentAt
                            ? "Resend email"
                            : "Email invitation"}
                        </Button>
                        {invitation.emailSentAt ? (
                          <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                            Emailed{" "}
                            {new Date(
                              invitation.emailSentAt,
                            ).toLocaleDateString()}
                          </p>
                        ) : null}
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {experience.status !== "revoked" ? (
              <form action={revokeGiftExperience}>
                <input
                  type="hidden"
                  name="giftExperienceId"
                  value={experience.id}
                />
                <Button type="submit" variant="outline" size="sm">
                  Revoke
                </Button>
              </form>
            ) : null}
          </Card>
        ))}
        {experienceDetails.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--color-stone-500)]">
              No gift experiences yet.
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
