import {
  CoachingRepository,
  CoveragePlanningRepository,
  RetailerStaffRepository,
  StaffRosterRepository,
} from "@paon/database";
import { retailerRoleAtLeast } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";

import {
  ApproveSwapForm,
  AvailabilityForm,
  CoachingStepForm,
  CoveragePlanForm,
  ObservationForm,
  SwapRequestForm,
  SwapResponseForm,
  WithdrawSwapForm,
} from "./coverage-forms";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function CoveragePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly date?: string }>;
}) {
  const session = await requireSession();
  const { date } = await searchParams;
  const planDate = /^\d{4}-\d{2}-\d{2}$/.test(date ?? "")
    ? date!
    : new Date().toISOString().slice(0, 10);
  const supabase = await getSupabaseServerClient();
  const coverage = new CoveragePlanningRepository(supabase);
  const coaching = new CoachingRepository(supabase);
  const staff = new RetailerStaffRepository(supabase);
  const roster = new StaffRosterRepository(supabase);
  const today = new Date().toISOString().slice(0, 10);
  const shiftWindowEnd = new Date(Date.now() + 60 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const [plan, shortages, observations, team, viewer, openSwaps, shifts] =
    await Promise.all([
      coverage.findPlanForDate({ retailerId: session.retailerId, planDate }),
      coverage.recommendForDate({ retailerId: session.retailerId, planDate }),
      coaching.listObservations({ retailerId: session.retailerId }),
      staff.findByRetailer(session.retailerId),
      staff.findByUserId(session.userId),
      coverage.listOpenSwaps({ retailerId: session.retailerId }),
      roster.findShiftsByRetailer(session.retailerId, {
        from: today,
        to: shiftWindowEnd,
      }),
    ]);
  const isManager = retailerRoleAtLeast(session.retailerRole, "manager");
  const nameById = new Map(
    team.map((member) => [member.id as string, member.fullName]),
  );
  const availability = viewer
    ? await coverage.listAvailability({
        retailerId: session.retailerId,
        staffId: viewer.id,
      })
    : [];
  const weekdayLabel = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Coverage
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          State what the floor needs, see why it is short, and close coaching
          loops. PAON never assigns a shift here.
        </p>
      </div>

      {isManager ? (
        <Card>
          <h2 className="text-sm font-medium">Publish the requirement</h2>
          <CoveragePlanForm planDate={planDate} />
        </Card>
      ) : null}

      <Card>
        <h2 className="text-sm font-medium">Published coverage · {planDate}</h2>
        {!plan ? (
          <p
            id="coverage-no-plan"
            className="mt-3 text-sm text-[var(--color-stone-500)]"
          >
            No coverage requirement published for this date.
          </p>
        ) : (
          <ul
            id="coverage-intervals"
            data-plan-state={plan.state}
            data-plan-interval-count={plan.intervals.length}
            className="mt-3 flex flex-col gap-2"
          >
            {plan.intervals.map((interval) => (
              <li
                key={`${interval.startTime}-${interval.endTime}`}
                className="rounded border border-[var(--color-stone-100)] p-3 text-sm"
              >
                <strong>
                  {interval.startTime}–{interval.endTime}
                </strong>{" "}
                · needs {interval.requiredHeadcount}
                {interval.requiredSkills?.length ? (
                  <span> · {interval.requiredSkills.join(", ")}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-medium">Explainable shortages</h2>
        {shortages.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            No shortage identified.
          </p>
        ) : (
          <ul id="coverage-shortages" className="mt-3 flex flex-col gap-3">
            {shortages.map((shortage, index) => (
              <li
                key={`${shortage.kind}-${shortage.startTime}-${index}`}
                className="rounded border border-[var(--color-stone-100)] p-3 text-sm"
              >
                <p>
                  {shortage.kind === "missing_required_skill"
                    ? `missing ${shortage.missingSkill}`
                    : shortage.rationale}
                </p>
                <ul className="mt-1 text-xs text-[var(--color-stone-500)]">
                  {shortage.citations.map((citation) => (
                    <li key={`${citation.sourceRef}-${citation.windowStart}`}>
                      {citation.sourceRef} · {citation.observedValue} observed
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-medium">Your availability</h2>
        {availability.length === 0 ? (
          <p
            id="availability-empty"
            className="mt-3 text-sm text-[var(--color-stone-500)]"
          >
            You have not declared any availability yet.
          </p>
        ) : (
          <ul
            id="availability-declarations"
            className="mt-3 flex flex-col gap-2"
          >
            {availability.map((declaration) => (
              <li
                key={declaration.id}
                data-available={declaration.available}
                className="rounded border border-[var(--color-stone-100)] p-3 text-sm"
              >
                <strong>{weekdayLabel[declaration.weekday]}</strong>{" "}
                {declaration.start_time.slice(0, 5)}–
                {declaration.end_time.slice(0, 5)} ·{" "}
                {declaration.available ? "available" : "not available"}
                {declaration.note ? <span> · {declaration.note}</span> : null}
                <span className="ml-2 text-xs text-[var(--color-stone-400)]">
                  from {declaration.effective_on}
                </span>
              </li>
            ))}
          </ul>
        )}
        <AvailabilityForm defaultEffectiveOn={planDate} />
      </Card>

      <Card>
        <h2 className="text-sm font-medium">Shift swaps</h2>
        {openSwaps.length === 0 ? (
          <p
            id="swaps-empty"
            className="mt-3 text-sm text-[var(--color-stone-500)]"
          >
            No open swap requests.
          </p>
        ) : (
          <ul id="open-swaps" className="mt-3 flex flex-col gap-3">
            {openSwaps.map((swap) => {
              const shift = shifts.find((s) => s.id === swap.shift_id);
              const isRequester = viewer?.id === swap.requesting_staff_id;
              const isPeer = viewer?.id === swap.peer_staff_id;
              return (
                <li
                  key={swap.id}
                  data-swap-id={swap.id}
                  data-swap-state={swap.state}
                  className="rounded border border-[var(--color-stone-100)] p-3 text-sm"
                >
                  <p>
                    <strong>
                      {nameById.get(swap.requesting_staff_id) ?? "Unknown"}
                    </strong>{" "}
                    offers{" "}
                    {shift
                      ? `${shift.shiftDate} ${shift.startTime.slice(0, 5)}–${shift.endTime.slice(0, 5)}`
                      : "a shift"}{" "}
                    to{" "}
                    <strong>
                      {nameById.get(swap.peer_staff_id) ?? "Unknown"}
                    </strong>
                    <Badge tone="neutral">
                      {swap.state.replaceAll("_", " ")}
                    </Badge>
                  </p>
                  {swap.reason ? (
                    <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                      {swap.reason}
                    </p>
                  ) : null}
                  {isPeer && swap.state === "requested" ? (
                    <SwapResponseForm swapId={swap.id} />
                  ) : null}
                  {isRequester &&
                  (swap.state === "requested" ||
                    swap.state === "accepted_by_peer") ? (
                    <WithdrawSwapForm swapId={swap.id} />
                  ) : null}
                  {isManager && swap.state === "accepted_by_peer" ? (
                    <ApproveSwapForm swapId={swap.id} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {viewer ? (
          <SwapRequestForm
            myShifts={shifts
              .filter((s) => s.staffId === viewer.id)
              .map((s) => ({
                id: s.id,
                label: `${s.shiftDate} ${s.startTime.slice(0, 5)}–${s.endTime.slice(0, 5)}`,
              }))}
            team={team
              .filter((member) => member.id !== viewer.id)
              .map((member) => ({ id: member.id, fullName: member.fullName }))}
          />
        ) : null}
      </Card>

      {isManager ? (
        <Card>
          <h2 className="text-sm font-medium">Record an observation</h2>
          <ObservationForm
            planDate={planDate}
            team={team.map((member) => ({
              id: member.id,
              fullName: member.fullName,
            }))}
          />
        </Card>
      ) : null}

      <Card>
        <h2 className="text-sm font-medium">Coaching loops</h2>
        {observations.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            No observations yet.
          </p>
        ) : (
          <ul id="coaching-observations" className="mt-3 flex flex-col gap-4">
            {observations.map((observation) => (
              <li
                key={observation.id}
                data-coaching-state={observation.state}
                className="rounded border border-[var(--color-stone-100)] p-3"
              >
                <div className="flex items-center gap-2">
                  <strong className="text-sm">
                    {nameById.get(observation.observed_staff_id) ??
                      "Unknown colleague"}
                  </strong>
                  <Badge
                    tone={
                      observation.state === "outcome_recorded"
                        ? "success"
                        : "neutral"
                    }
                  >
                    {observation.state.replaceAll("_", " ")}
                  </Badge>
                </div>
                {observation.agreed_action ? (
                  <p className="mt-2 text-sm">
                    Plan: {observation.agreed_action}
                  </p>
                ) : null}
                {observation.outcome_note ? (
                  <p className="mt-1 text-sm">
                    Outcome: {observation.outcome_note}
                  </p>
                ) : null}
                {isManager && observation.state !== "outcome_recorded" ? (
                  <CoachingStepForm
                    observationId={observation.id}
                    state={observation.state}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
