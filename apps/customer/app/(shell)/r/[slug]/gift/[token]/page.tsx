import { GiftRepository } from "@paon/database";
import { GIFT_INVITATION_STATUS_LABELS } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { formatMoney } from "@paon/utils";
import Image from "next/image";
import { notFound } from "next/navigation";

import { RedeemForm } from "./redeem-form";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function GiftRevealPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const supabase = await getSupabaseServerClient();

  const reveal = await new GiftRepository(supabase)
    .resolveInvitation(token)
    .catch(() => null);
  if (!reveal) notFound();

  const redeemedItem = reveal.items.find(
    (item) => item.curatedItemId === reveal.redeemedCuratedItemId,
  );

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
        {reveal.retailerDisplayName}
      </p>
      <h1 className="font-display mt-1 text-3xl text-[var(--color-stone-900)]">
        {reveal.title}
      </h1>
      <p className="mt-3 text-[var(--color-stone-600)]">
        {reveal.introMessage}
      </p>

      <Card className="paon-reveal mt-6">
        {reveal.status === "redeemed" ? (
          <p className="text-sm text-[var(--color-stone-700)]" role="status">
            {redeemedItem
              ? `You chose ${redeemedItem.productName}. We've let ${reveal.retailerDisplayName} know — they'll be in touch.`
              : "This gift has been redeemed."}
          </p>
        ) : reveal.status === "expired" ? (
          <p className="text-sm text-[var(--color-stone-700)]">
            This gift link has expired. Reach out to{" "}
            {reveal.retailerDisplayName} for help.
          </p>
        ) : reveal.status === "revoked" ? (
          <p className="text-sm text-[var(--color-stone-700)]">
            This gift link is no longer active.
          </p>
        ) : (
          <RedeemForm slug={slug} token={token} items={reveal.items} />
        )}
      </Card>

      {reveal.status !== "redeemed" ? (
        <ul className="mt-6 flex flex-col gap-3">
          {reveal.items.map((item) => (
            <li
              key={item.curatedItemId}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3"
            >
              {item.primaryImageUrl ? (
                <Image
                  src={item.primaryImageUrl}
                  alt={item.productName}
                  width={56}
                  height={56}
                  className="rounded-[var(--radius-sm)] object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.productName}</p>
                {item.note ? (
                  <p className="truncate text-sm text-[var(--color-stone-500)]">
                    {item.note}
                  </p>
                ) : null}
              </div>
              <p className="text-sm">{formatMoney(item.price, "en-US")}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-6 text-xs text-[var(--color-stone-400)]">
        {GIFT_INVITATION_STATUS_LABELS[reveal.status]}
      </p>
    </main>
  );
}
