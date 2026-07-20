import { CustomerRepository, WeddingPartyRepository } from "@paon/database";
import {
  WEDDING_PARTY_MEMBER_FITTING_STATUSES,
  WEDDING_PARTY_STATUSES,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import { notFound } from "next/navigation";

import {
  updateMemberFittingStatus,
  updateWeddingPartyStatus,
} from "../actions";

import { AddMemberForm } from "./add-member-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const FITTING_TONE = {
  invited: "neutral",
  scheduled: "warning",
  fitted: "success",
  completed: "success",
} as const;

export default async function WeddingPartyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const repo = new WeddingPartyRepository(supabase);

  const party = await repo.findById(id as never);
  if (!party || party.retailerId !== session.retailerId) notFound();

  const [members, organizer] = await Promise.all([
    repo.findMembers(party.id),
    new CustomerRepository(supabase).findById(party.organizerCustomerId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[var(--color-stone-900)]">
            {organizer?.fullName ?? "Wedding party"}
          </h1>
          <p className="text-sm text-[var(--color-stone-500)]">
            {party.eventDate
              ? formatDate(party.eventDate, "en-US")
              : "No date set"}
            {party.venueName ? ` · ${party.venueName}` : ""}
          </p>
        </div>
        <form
          action={updateWeddingPartyStatus}
          className="flex items-center gap-2"
        >
          <input type="hidden" name="weddingPartyId" value={party.id} />
          <select
            name="status"
            defaultValue={party.status}
            className="rounded-[var(--radius-sm)] border border-[var(--color-stone-300)] px-2 py-1 text-sm capitalize"
          >
            {WEDDING_PARTY_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Update
          </button>
        </form>
      </div>

      {party.notes ? (
        <Card>
          <p className="text-sm text-[var(--color-stone-700)]">{party.notes}</p>
        </Card>
      ) : null}

      <div>
        <h2 className="mb-3 text-lg font-medium text-[var(--color-stone-900)]">
          Party members
        </h2>
        <Card className="divide-y p-0">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between px-6 py-4"
            >
              <div>
                <p className="font-medium">{member.name}</p>
                <p className="text-sm capitalize text-[var(--color-stone-500)]">
                  {member.role.replaceAll("_", " ")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={FITTING_TONE[member.fittingStatus]}>
                  {member.fittingStatus}
                </Badge>
                <form
                  action={updateMemberFittingStatus}
                  className="flex items-center gap-2"
                >
                  <input type="hidden" name="memberId" value={member.id} />
                  <input type="hidden" name="weddingPartyId" value={party.id} />
                  <select
                    name="status"
                    defaultValue={member.fittingStatus}
                    className="rounded-[var(--radius-sm)] border border-[var(--color-stone-300)] px-2 py-1 text-xs capitalize"
                  >
                    {WEDDING_PARTY_MEMBER_FITTING_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Update
                  </button>
                </form>
              </div>
            </div>
          ))}
          {members.length === 0 ? (
            <p className="p-6 text-sm text-[var(--color-stone-500)]">
              No members added yet.
            </p>
          ) : null}
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium text-[var(--color-stone-900)]">
          Add a member
        </h2>
        <Card>
          <AddMemberForm weddingPartyId={party.id} />
        </Card>
      </div>
    </div>
  );
}
