import { CustomerRepository, WeddingPartyRepository } from "@paon/database";
import { WEDDING_PARTY_STATUS_LABELS } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Image from "next/image";
import Link from "next/link";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const STATUS_TONE = {
  planning: "neutral",
  confirmed: "success",
  completed: "success",
  cancelled: "danger",
} as const;

export default async function WeddingPartiesPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const [parties, customers] = await Promise.all([
    new WeddingPartyRepository(supabase).findByRetailer(session.retailerId),
    new CustomerRepository(supabase).findByRetailer(session.retailerId),
  ]);
  const names = new Map(customers.map((item) => [item.id, item.fullName]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
            Wedding Parties
          </h1>
          <p className="text-sm text-[var(--color-stone-500)]">
            Coordinate a groom&rsquo;s party across every member&rsquo;s
            fitting.
          </p>
        </div>
      </div>

      <Card className="paon-reveal divide-y overflow-hidden rounded-[var(--radius-md)] p-0 shadow-[var(--shadow-elevated)]">
        {parties.map((party) => (
          <Link
            key={party.id}
            href={`/wedding-parties/${party.id}`}
            className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-[var(--color-stone-50)]"
          >
            <div className="flex min-w-0 items-center gap-4">
              {party.coverPhotoUrl ? (
                <Image
                  src={party.coverPhotoUrl}
                  alt=""
                  width={48}
                  height={48}
                  unoptimized
                  className="h-12 w-12 shrink-0 rounded-[var(--radius-md)] object-cover"
                />
              ) : (
                <div
                  aria-hidden
                  className="h-12 w-12 shrink-0 rounded-[var(--radius-md)] bg-[var(--color-stone-100)]"
                />
              )}
              <div className="min-w-0">
                <p className="font-medium">
                  {names.get(party.organizerCustomerId) ?? "Customer"}
                </p>
                <p className="text-sm text-[var(--color-stone-500)]">
                  {party.eventDate
                    ? formatDate(party.eventDate, "en-US")
                    : "No date set"}
                  {party.eventTime ? ` · ${party.eventTime}` : ""}
                  {party.fittingLocation
                    ? ` · Fitting at ${party.fittingLocation}`
                    : party.venueName
                      ? ` · ${party.venueName}`
                      : ""}
                </p>
              </div>
            </div>
            <Badge className="shrink-0" tone={STATUS_TONE[party.status]}>
              {WEDDING_PARTY_STATUS_LABELS[party.status]}
            </Badge>
          </Link>
        ))}
        {parties.length === 0 ? (
          <div className="flex flex-col items-start gap-3 p-6">
            <p className="text-sm text-[var(--color-stone-500)]">
              No wedding parties yet — start one from a client record.
            </p>
            <Link href="/customers" className={buttonVariants()}>
              Open Clients
            </Link>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
