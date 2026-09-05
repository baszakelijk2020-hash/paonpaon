"use client";

import type { WeddingDateCandidate, WeddingDateVote } from "@paon/domain";
import { buttonVariants } from "@paon/ui/components/Button";
import { formatDate } from "@paon/utils";
import { useActionState } from "react";

import {
  finalizeWeddingDate,
  proposeWeddingDateCandidate,
  toggleWeddingDateVote,
  type ProposeDateCandidateState,
} from "../actions";

const initial: ProposeDateCandidateState = {};

export function DateCandidatesPanel({
  weddingPartyId,
  candidates,
  votes,
  myMemberId,
  isOrganizer,
}: {
  weddingPartyId: string;
  candidates: WeddingDateCandidate[];
  votes: WeddingDateVote[];
  myMemberId?: string;
  isOrganizer: boolean;
}) {
  const boundAction = proposeWeddingDateCandidate.bind(null, weddingPartyId);
  const [state, formAction, isPending] = useActionState(boundAction, initial);

  return (
    <div className="flex flex-col gap-3">
      {candidates.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {candidates.map((candidate) => {
            const candidateVotes = votes.filter(
              (vote) => vote.weddingDateCandidateId === candidate.id,
            );
            const myVote = myMemberId
              ? candidateVotes.some(
                  (vote) => vote.weddingPartyMemberId === myMemberId,
                )
              : false;
            return (
              <li
                key={candidate.id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm"
              >
                <span>{formatDate(candidate.candidateDate, "en-US")}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--color-stone-500)]">
                    {candidateVotes.length} vote
                    {candidateVotes.length === 1 ? "" : "s"}
                  </span>
                  {myMemberId ? (
                    <form action={toggleWeddingDateVote}>
                      <input
                        type="hidden"
                        name="candidateId"
                        value={candidate.id}
                      />
                      <input
                        type="hidden"
                        name="weddingPartyId"
                        value={weddingPartyId}
                      />
                      <button
                        type="submit"
                        className={buttonVariants({
                          variant: myVote ? "primary" : "outline",
                          size: "sm",
                        })}
                      >
                        {myVote ? "Voted" : "Vote"}
                      </button>
                    </form>
                  ) : null}
                  {isOrganizer ? (
                    <form action={finalizeWeddingDate}>
                      <input
                        type="hidden"
                        name="candidateDate"
                        value={candidate.candidateDate}
                      />
                      <input
                        type="hidden"
                        name="weddingPartyId"
                        value={weddingPartyId}
                      />
                      <button
                        type="submit"
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        Finalize
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-[var(--color-stone-500)]">
          No dates proposed yet.
        </p>
      )}
      <form action={formAction} className="flex items-center gap-2">
        <input
          type="date"
          name="candidateDate"
          required
          className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-3 text-sm text-[var(--color-stone-900)]"
        />
        <button
          type="submit"
          disabled={isPending}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {isPending ? "Adding…" : "Propose date"}
        </button>
      </form>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
    </div>
  );
}
