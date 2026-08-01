"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import {
  acknowledgeAnnouncement,
  publishAnnouncement,
  type AnnouncementActionState,
} from "./actions";

const initial: AnnouncementActionState = {};

export interface PublishAudienceOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Manager form to publish an announcement.
 */
export function PublishAnnouncementForm({
  audienceOptions,
}: {
  readonly audienceOptions: readonly PublishAudienceOption[];
}) {
  const [state, action, pending] = useActionState(publishAnnouncement, initial);

  return (
    <form action={action} className="mt-3 flex flex-col gap-4">
      <FormField htmlFor="title" label="Title" error={state.formError}>
        <Input
          id="title"
          name="title"
          type="text"
          required
          minLength={3}
          maxLength={200}
          placeholder="e.g., New opening hours starting Monday"
          disabled={pending}
        />
      </FormField>

      <FormField htmlFor="body" label="Announcement">
        <textarea
          id="body"
          name="body"
          required
          minLength={10}
          maxLength={2000}
          placeholder="Tell your team what they need to know."
          rows={4}
          disabled={pending}
          className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-stone-400)]"
        />
      </FormField>

      <FormField htmlFor="audienceType" label="Audience">
        <Select
          id="audienceType"
          name="audienceType"
          required
          disabled={pending}
        >
          <option value="">Select audience…</option>
          {audienceOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </FormField>

      <label className="flex items-center gap-2 text-sm text-[var(--color-stone-900)]">
        <input
          type="checkbox"
          name="requiresAcknowledgement"
          disabled={pending}
          className="h-4 w-4 rounded border border-[var(--color-stone-300)] accent-[var(--color-stone-900)]"
        />
        <span>Requires acknowledgement</span>
      </label>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Publishing…" : "Publish announcement"}
        </Button>
      </div>

      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}

      {state.notice ? (
        <p role="status" className="text-sm text-[var(--color-stone-500)]">
          {state.notice}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Staff acknowledgement button for one announcement.
 */
export function AcknowledgeAnnouncementForm({
  announcementId,
}: {
  readonly announcementId: string;
}) {
  const [state, action, pending] = useActionState(
    acknowledgeAnnouncement,
    initial,
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="announcementId" value={announcementId} />
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Recording…" : "I have read this"}
        </Button>
      </div>
      {state.formError ? (
        <p role="alert" className="text-xs text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" className="text-xs text-[var(--color-stone-500)]">
          {state.notice}
        </p>
      ) : null}
    </form>
  );
}
