"use client";

import type {
  AcademyRoleplayMessage,
  AcademyRoleplaySession,
} from "@paon/database";
import {
  ACADEMY_ROLEPLAY_PERSONA_LABELS,
  ACADEMY_ROLEPLAY_PERSONAS,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Select } from "@paon/ui/components/Select";
import { useActionState, useState, useTransition } from "react";

import {
  endRoleplaySession,
  startRoleplaySession,
  submitRoleplayMessage,
  type RoleplayActionState,
} from "./roleplay-actions";

const initial: RoleplayActionState = {};

/**
 * The AI sales-roleplay practice partner (PHASE 17.8 / ADV-108). Starts
 * (or resumes) the advisor's own active session, then drives one real
 * turn per submit through `submitRoleplayMessage` — the transcript shown
 * here is exactly `academy_roleplay_messages`, never a client-only echo.
 */
export function RoleplayPractice({
  activeSession,
  activeMessages,
}: {
  readonly activeSession: AcademyRoleplaySession | null;
  readonly activeMessages: readonly AcademyRoleplayMessage[];
}) {
  const [startState, startAction, startPending] = useActionState(
    startRoleplaySession,
    initial,
  );
  const session = startState.session ?? activeSession;
  const messages = startState.messages ?? activeMessages;

  if (!session) {
    return (
      <form action={startAction} className="mt-3 flex flex-col gap-4">
        <FormField htmlFor="roleplay-persona" label="Persona">
          <Select id="roleplay-persona" name="personaKey" defaultValue="">
            <option value="" disabled>
              Choose who to practice with
            </option>
            {ACADEMY_ROLEPLAY_PERSONAS.map((persona) => (
              <option key={persona} value={persona}>
                {ACADEMY_ROLEPLAY_PERSONA_LABELS[persona]}
              </option>
            ))}
          </Select>
        </FormField>
        {startState.formError ? (
          <p className="text-sm text-red-600">{startState.formError}</p>
        ) : null}
        <Button type="submit" disabled={startPending}>
          Start practice
        </Button>
      </form>
    );
  }

  return (
    <ActiveSession
      key={session.id}
      session={session}
      initialMessages={messages}
    />
  );
}

function ActiveSession({
  session,
  initialMessages,
}: {
  readonly session: AcademyRoleplaySession;
  readonly initialMessages: readonly AcademyRoleplayMessage[];
}) {
  const boundSubmit = submitRoleplayMessage.bind(null, session.id);
  const [state, action, pending] = useActionState(boundSubmit, initial);
  const [ending, startEndTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const messages = state.messages ?? initialMessages;
  const personaLabel = ACADEMY_ROLEPLAY_PERSONA_LABELS[session.personaKey];

  return (
    <div id="roleplay-active-session" className="mt-3 flex flex-col gap-4">
      <p className="text-xs text-[var(--color-stone-500)]">
        Practicing: {personaLabel.split(" — ")[0]}
      </p>

      <ul
        id="roleplay-transcript"
        className="flex max-h-96 flex-col gap-2 overflow-y-auto rounded border border-[var(--color-stone-100)] p-3"
      >
        {messages.length === 0 ? (
          <li className="text-sm text-[var(--color-stone-500)]">
            Say hello to open the conversation.
          </li>
        ) : (
          messages.map((message) => (
            <li
              key={message.id}
              data-speaker={message.speaker}
              className={
                message.speaker === "advisor"
                  ? "self-end rounded bg-[var(--color-stone-900)] px-3 py-2 text-sm text-white"
                  : "self-start rounded bg-[var(--color-stone-100)] px-3 py-2 text-sm text-[var(--color-stone-900)]"
              }
            >
              {message.content}
            </li>
          ))
        )}
      </ul>

      <form
        action={action}
        className="flex flex-col gap-2"
        onSubmit={() => setDraft("")}
      >
        <textarea
          id="roleplay-advisor-text"
          name="advisorText"
          required
          minLength={1}
          maxLength={4000}
          disabled={pending}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="What do you say?"
          className="rounded border border-[var(--color-stone-200)] p-2 text-sm"
        />
        {state.formError ? (
          <p className="text-sm text-red-600">{state.formError}</p>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            Send
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={ending}
            onClick={() =>
              startEndTransition(async () => {
                await endRoleplaySession(session.id, "completed");
              })
            }
          >
            End session
          </Button>
        </div>
      </form>
    </div>
  );
}
