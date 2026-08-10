"use client";

import type { RecognitionAct } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { useActionState, useState } from "react";

import type { CloseoutActionState } from "./actions";
import { submitCloseout } from "./actions";

const initial: CloseoutActionState = {};

export function SubmitCloseoutForm(args: {
  readonly closeoutDate: string;
  readonly todayActsForStaff: readonly RecognitionAct[];
  readonly initialCloseout?: {
    readonly promisesNote: string;
    readonly whatWorkedNote: string;
    readonly factsLearnedNote?: string;
    readonly problemsNote?: string;
    readonly anomaliesNote?: string;
    readonly helpRequestedNote?: string;
    readonly extraMileActId?: string;
  };
}) {
  const [state, action, isPending] = useActionState(submitCloseout, initial);
  const [selectedActId, setSelectedActId] = useState<string>(
    args.initialCloseout?.extraMileActId ?? "",
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="closeoutDate" value={args.closeoutDate} />

      <div>
        <label htmlFor="promisesNote" className="block text-sm font-medium">
          Promises made (required)
        </label>
        <textarea
          id="promisesNote"
          name="promisesNote"
          defaultValue={args.initialCloseout?.promisesNote ?? ""}
          placeholder="What did you commit to getting done?"
          className="mt-1 block w-full rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
          rows={3}
          required
        />
      </div>

      <div>
        <label htmlFor="whatWorkedNote" className="block text-sm font-medium">
          What worked today (required)
        </label>
        <textarea
          id="whatWorkedNote"
          name="whatWorkedNote"
          defaultValue={args.initialCloseout?.whatWorkedNote ?? ""}
          placeholder="What went well? What should we repeat?"
          className="mt-1 block w-full rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
          rows={3}
          required
        />
      </div>

      <div>
        <label htmlFor="factsLearnedNote" className="block text-sm font-medium">
          Customer facts learned
        </label>
        <textarea
          id="factsLearnedNote"
          name="factsLearnedNote"
          defaultValue={args.initialCloseout?.factsLearnedNote ?? ""}
          placeholder="Anything new about customers or their preferences?"
          className="mt-1 block w-full rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
          rows={2}
        />
      </div>

      <div>
        <label htmlFor="problemsNote" className="block text-sm font-medium">
          Problems requiring management
        </label>
        <textarea
          id="problemsNote"
          name="problemsNote"
          defaultValue={args.initialCloseout?.problemsNote ?? ""}
          placeholder="What needs a manager's attention?"
          className="mt-1 block w-full rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
          rows={2}
        />
      </div>

      <div>
        <label htmlFor="anomaliesNote" className="block text-sm font-medium">
          Stock or service anomalies
        </label>
        <textarea
          id="anomaliesNote"
          name="anomaliesNote"
          defaultValue={args.initialCloseout?.anomaliesNote ?? ""}
          placeholder="Any unusual stock movements or service issues?"
          className="mt-1 block w-full rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
          rows={2}
        />
      </div>

      <div>
        <label
          htmlFor="helpRequestedNote"
          className="block text-sm font-medium"
        >
          Help or coaching requested
        </label>
        <textarea
          id="helpRequestedNote"
          name="helpRequestedNote"
          defaultValue={args.initialCloseout?.helpRequestedNote ?? ""}
          placeholder="What help or coaching would move you forward?"
          className="mt-1 block w-full rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
          rows={2}
        />
      </div>

      {args.todayActsForStaff.length > 0 ? (
        <div>
          <label htmlFor="extraMileActId" className="block text-sm font-medium">
            Link an extra-mile act logged today
          </label>
          <select
            id="extraMileActId"
            name="extraMileActId"
            value={selectedActId}
            onChange={(e) => setSelectedActId(e.target.value)}
            className="mt-1 block w-full rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
          >
            <option value="">No extra-mile act to link</option>
            {args.todayActsForStaff.map((act) => (
              <option key={act.id} value={act.id}>
                {act.narrative.slice(0, 60)}
                {act.narrative.length > 60 ? "..." : ""}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {state.formError && (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      )}
      {state.notice && (
        <p role="status" className="text-sm text-[var(--color-stone-500)]">
          {state.notice}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save closeout"}
      </Button>
    </form>
  );
}
