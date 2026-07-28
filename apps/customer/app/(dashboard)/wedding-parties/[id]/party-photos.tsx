"use client";

import { Button } from "@paon/ui/components/Button";
import Image from "next/image";
import { useActionState } from "react";

import {
  uploadMemberPhoto,
  uploadPartyCoverPhoto,
  type PartyPhotoActionState,
} from "../actions";

const initial: PartyPhotoActionState = {};

export function PartyCoverUploader({
  partyId,
  coverPhotoUrl,
}: {
  partyId: string;
  coverPhotoUrl?: string;
}) {
  const [state, action, pending] = useActionState(
    uploadPartyCoverPhoto.bind(null, partyId),
    initial,
  );

  return (
    <div className="flex flex-col gap-3">
      {coverPhotoUrl ? (
        <Image
          src={coverPhotoUrl}
          alt=""
          width={320}
          height={180}
          unoptimized
          className="h-40 w-full rounded-[var(--radius-md)] object-cover"
        />
      ) : (
        <p className="text-sm text-[var(--color-stone-500)]">
          No cover photo yet — add one so the party looks like yours.
        </p>
      )}
      <form
        action={action}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <input
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp"
          required
          aria-label="Party cover photo"
        />
        <Button type="submit" size="sm" disabled={pending}>
          {pending
            ? "Uploading…"
            : coverPhotoUrl
              ? "Replace cover"
              : "Upload cover"}
        </Button>
      </form>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
    </div>
  );
}

export function MemberPhotoUploader({
  partyId,
  memberId,
  memberName,
  photoUrl,
}: {
  partyId: string;
  memberId: string;
  memberName: string;
  photoUrl?: string;
}) {
  const [state, action, pending] = useActionState(
    uploadMemberPhoto.bind(null, partyId, memberId),
    initial,
  );

  return (
    <div className="flex items-center gap-3">
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt=""
          width={40}
          height={40}
          unoptimized
          className="h-10 w-10 rounded-full object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-stone-200)] text-sm text-[var(--color-stone-600)]"
        >
          {memberName.charAt(0).toUpperCase()}
        </div>
      )}
      <form action={action} className="flex flex-col gap-1">
        <input
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp"
          required
          aria-label={`Photo for ${memberName}`}
          className="text-xs"
        />
        <Button type="submit" size="sm" variant="ghost" disabled={pending}>
          {pending ? "Uploading…" : photoUrl ? "Replace" : "Add photo"}
        </Button>
        {state.formError ? (
          <p role="alert" className="text-xs text-[var(--color-danger-500)]">
            {state.formError}
          </p>
        ) : null}
      </form>
    </div>
  );
}
