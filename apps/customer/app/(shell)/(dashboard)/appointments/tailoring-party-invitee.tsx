"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  joinWeddingParty,
  type JoinPartyState,
} from "../../r/[slug]/wedding-parties/join/[token]/actions";
import { GuestPortalPreview } from "../guest-portal-preview";
import { setPartyAttendance } from "../wedding-parties/actions";

import { formatDateLabel } from "./quick-book-bar";
import { TailoringPartyChat } from "./tailoring-party-chat";

export type TailoringPartyInvite = {
  readonly token: string;
  readonly retailerName: string;
  readonly eventDate?: string;
  readonly eventTime?: string;
  readonly venueName?: string;
  readonly fittingLocation?: string;
};

type Draft = {
  name: string;
  surname: string;
  email: string;
  phone: string;
  heightCm: string;
  weightKg: string;
  photo?: string;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  surname: "",
  email: "",
  phone: "",
  heightCm: "",
  weightKg: "",
};

/** Photos up to this size ride along in the saved draft as a data URL. */
const DRAFT_PHOTO_LIMIT = 2_500_000;

const draftKey = (token: string) => `paon-party-join:${token}`;

type Attendance = "attending" | "declined" | "rebooked";

/** What the device keeps: the draft while filling in; once joined, only the
 * member id, the name shown in the chat and the attendance — the details
 * themselves are with the party, so they are wiped from the device. */
type Saved = {
  draft: Draft;
  joined: boolean;
  memberId?: string;
  displayName?: string;
  attendance?: Attendance;
};

function readSaved(token: string): Saved {
  try {
    const raw = window.localStorage.getItem(draftKey(token));
    if (!raw) return { draft: EMPTY_DRAFT, joined: false };
    const parsed = JSON.parse(raw) as Partial<Draft> &
      Omit<Partial<Saved>, "draft">;
    const { joined, memberId, displayName, attendance, ...rest } = parsed;
    return {
      draft: joined ? EMPTY_DRAFT : { ...EMPTY_DRAFT, ...rest },
      joined: Boolean(joined),
      ...(memberId ? { memberId } : {}),
      ...(displayName ? { displayName } : {}),
      ...(attendance ? { attendance } : {}),
    };
  } catch {
    return { draft: EMPTY_DRAFT, joined: false };
  }
}

function writeSaved(token: string, saved: Saved) {
  try {
    const value = saved.joined
      ? {
          joined: true,
          ...(saved.memberId ? { memberId: saved.memberId } : {}),
          ...(saved.displayName ? { displayName: saved.displayName } : {}),
          ...(saved.attendance ? { attendance: saved.attendance } : {}),
        }
      : { ...saved.draft, joined: false };
    window.localStorage.setItem(draftKey(token), JSON.stringify(value));
  } catch {
    // A full or blocked store only loses the convenience, never the join.
  }
}

/**
 * What an invited guest sees on Appointments, under the booking bar and
 * above everything else: the party as the organizer set it up, and their own
 * details — name, surname, email, phone, height, weight and a photo.
 *
 * Joining needs no account (the invite link is the permission, checked by
 * `join_wedding_party`), so everything is saved before an account is ever
 * mentioned. Creating a profile then opens the Wardrobe's sign-in card
 * (Apple, Google, email) prefilled with their email. Because Apple and
 * Google leave the page, the form is also kept on this device as it is
 * typed and put back on return — nothing typed is lost either way. Once
 * joined, the details are wiped from the device (they are with the party);
 * only the member id, the chat name and the attendance stay.
 *
 * A joined guest can say they cannot make the group fitting and book one of
 * their own from the bar at the top; the organizer sees Cancelled, then
 * Rebooked, in the party's status column.
 *
 * The phone number is kept with the draft but not yet saved to the party:
 * the join function has no phone field (a database change is needed).
 */
export function TailoringPartyInvitee({
  invite,
  isGuest,
}: {
  invite: TailoringPartyInvite;
  isGuest: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [joined, setJoined] = useState(false);
  const [memberId, setMemberId] = useState<string | undefined>();
  const [displayName, setDisplayName] = useState("");
  const [attendance, setAttendance] = useState<Attendance>("attending");
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | undefined>();
  const [signingIn, setSigningIn] = useState(false);
  const restored = useRef(false);
  const [state, formAction, isPending] = useActionState<
    JoinPartyState,
    FormData
  >(joinWeddingParty.bind(null, invite.token), {});

  // Put back whatever was typed before a sign-in detour.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const saved = readSaved(invite.token);
    setDraft(saved.draft);
    setJoined(saved.joined);
    if (saved.memberId) setMemberId(saved.memberId);
    if (saved.displayName) setDisplayName(saved.displayName);
    if (saved.attendance) setAttendance(saved.attendance);
    if (saved.draft.photo) {
      setPhotoPreview(saved.draft.photo);
      fetch(saved.draft.photo)
        .then((response) => response.blob())
        .then((blob) =>
          setPhotoFile(
            new File([blob], "photo", { type: blob.type || "image/jpeg" }),
          ),
        )
        .catch(() => undefined);
    }
  }, [invite.token]);

  useEffect(() => {
    if (!restored.current) return;
    writeSaved(invite.token, {
      draft,
      joined,
      ...(memberId ? { memberId } : {}),
      ...(displayName ? { displayName } : {}),
      attendance,
    });
  }, [invite.token, draft, joined, memberId, displayName, attendance]);

  useEffect(() => {
    if (!state.joined) return;
    setJoined(true);
    if (state.memberId) setMemberId(state.memberId);
    setDisplayName(`${draft.name.trim()} ${draft.surname.trim()}`.trim());
    // The details are with the party now; nothing personal stays behind.
    setDraft(EMPTY_DRAFT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.joined, state.memberId]);

  const saveAttendance = async (next: Attendance) => {
    if (!memberId) {
      setAttendanceError("Join the party first.");
      return;
    }
    setAttendanceError(null);
    const result = await setPartyAttendance({
      inviteToken: invite.token,
      memberId,
      attendance: next,
    });
    if (!result.ok) {
      setAttendanceError(result.formError ?? "That could not be saved.");
      return;
    }
    setAttendance(next);
  };

  // A fitting booked from the bar at the top, while this guest cannot make
  // the group one, is shown to the organizer as rebooked.
  useEffect(() => {
    if (attendance !== "declined" || !memberId) return;
    const onBooked = () => {
      void saveAttendance("rebooked");
    };
    window.addEventListener("paon:appointment-booked", onBooked);
    return () =>
      window.removeEventListener("paon:appointment-booked", onBooked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendance, memberId]);

  useEffect(() => {
    if (!signingIn) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSigningIn(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [signingIn]);

  const set =
    (field: keyof Draft) => (event: React.ChangeEvent<HTMLInputElement>) =>
      setDraft((current) => ({ ...current, [field]: event.target.value }));

  const pickPhoto = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    if (file.size <= DRAFT_PHOTO_LIMIT) {
      const reader = new FileReader();
      reader.onload = () =>
        setDraft((current) => ({ ...current, photo: String(reader.result) }));
      reader.readAsDataURL(file);
    }
  };

  const submit = (formData: FormData) => {
    formData.set("name", `${draft.name.trim()} ${draft.surname.trim()}`.trim());
    formData.set("email", draft.email.trim());
    formData.set("role", "other");
    formData.set("heightCm", draft.heightCm);
    formData.set("weightKg", draft.weightKg);
    if (photoFile) formData.set("photo", photoFile);
    formAction(formData);
  };

  const location = invite.fittingLocation || invite.venueName;
  const initials =
    `${draft.name.trim().charAt(0)}${draft.surname.trim().charAt(0)}`.toUpperCase();

  return (
    <section
      className="appointment-tailoring-party-invitee"
      aria-label="Your tailoring party invitation"
    >
      <div className="appointment-quick-book-container">
        <div className="appointment-quick-book-bar is-readonly">
          <span
            className="appointment-quick-book-field"
            style={{ flexGrow: 2 }}
          >
            <span className="appointment-quick-book-trigger">
              {invite.eventDate
                ? formatDateLabel(invite.eventDate)
                : "Date to be set"}
            </span>
          </span>
          <span
            className="appointment-quick-book-field"
            style={{ flexGrow: 1 }}
          >
            <span className="appointment-quick-book-trigger">
              {invite.eventTime?.slice(0, 5) ?? "Time to be set"}
            </span>
          </span>
          <span
            className="appointment-quick-book-field"
            style={{ flexGrow: 2 }}
          >
            <span className="appointment-quick-book-trigger">
              {location ?? invite.retailerName}
            </span>
          </span>
        </div>
      </div>

      <div className="appointment-tailoring-party-invitee-row">
        <div className="appointment-tailoring-party-card appointment-tailoring-party-join">
          <p className="appointment-tailoring-party-join-lead">
            You&rsquo;re invited to a tailoring party at {invite.retailerName}.
            {joined ? " You’re in." : " Add your details to join."}
          </p>

          {joined ? (
            <>
              <div className="appointment-tailoring-party-attendance">
                <span>Will you make the group fitting?</span>
                <div className="appointment-tailoring-party-attendance-choice">
                  <button
                    type="button"
                    aria-pressed={attendance === "attending"}
                    onClick={() => void saveAttendance("attending")}
                  >
                    I&rsquo;ll be there
                  </button>
                  <button
                    type="button"
                    aria-pressed={attendance !== "attending"}
                    onClick={() =>
                      void saveAttendance(
                        attendance === "rebooked" ? "rebooked" : "declined",
                      )
                    }
                  >
                    I can&rsquo;t make it
                  </button>
                </div>
                {attendance === "declined" ? (
                  <button
                    type="button"
                    className="appointment-tailoring-party-send"
                    onClick={() => {
                      const bar = document.querySelector<HTMLElement>(
                        ".appointment-quick-book",
                      );
                      bar?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                      bar
                        ?.querySelector<HTMLButtonElement>(
                          ".appointment-quick-book-trigger",
                        )
                        ?.focus({ preventScroll: true });
                    }}
                  >
                    Book a fitting of your own
                  </button>
                ) : attendance === "rebooked" ? (
                  <span className="appointment-tailoring-party-attendance-note">
                    You have your own fitting; the organizer can see that.
                  </span>
                ) : null}
                {attendanceError ? (
                  <p className="appointment-tailoring-party-error" role="alert">
                    {attendanceError}
                  </p>
                ) : null}
              </div>
              <div className="appointment-tailoring-party-join-done">
                <span>
                  Your details and photo are with the party and the atelier.
                </span>
                {isGuest ? (
                  <button
                    type="button"
                    className="appointment-tailoring-party-send"
                    onClick={() => setSigningIn(true)}
                  >
                    Create your profile
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <form
              action={submit}
              className="appointment-tailoring-party-join-form"
            >
              <label
                className="appointment-tailoring-party-join-photo"
                title="Add your photo"
              >
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreview} alt="" />
                ) : initials ? (
                  initials
                ) : (
                  <svg
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6" />
                  </svg>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Profile photo"
                  onChange={(event) => {
                    pickPhoto(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
              <div className="appointment-tailoring-party-join-fields">
                <input
                  className="appointment-tailoring-party-input"
                  placeholder="Name"
                  aria-label="Name"
                  autoComplete="given-name"
                  value={draft.name}
                  onChange={set("name")}
                  required
                  maxLength={100}
                />
                <input
                  className="appointment-tailoring-party-input"
                  placeholder="Surname"
                  aria-label="Surname"
                  autoComplete="family-name"
                  value={draft.surname}
                  onChange={set("surname")}
                  required
                  maxLength={100}
                />
                <input
                  className="appointment-tailoring-party-input"
                  type="email"
                  placeholder="Email"
                  aria-label="Email"
                  autoComplete="email"
                  value={draft.email}
                  onChange={set("email")}
                  required
                  maxLength={254}
                />
                <input
                  className="appointment-tailoring-party-input"
                  type="tel"
                  placeholder="Phone number"
                  aria-label="Phone number"
                  autoComplete="tel"
                  value={draft.phone}
                  onChange={set("phone")}
                  maxLength={40}
                />
                <input
                  className="appointment-tailoring-party-input"
                  type="number"
                  inputMode="numeric"
                  placeholder="Height (cm)"
                  aria-label="Height in centimetres"
                  value={draft.heightCm}
                  onChange={set("heightCm")}
                  required
                  min={100}
                  max={250}
                />
                <input
                  className="appointment-tailoring-party-input"
                  type="number"
                  inputMode="numeric"
                  placeholder="Weight (kg)"
                  aria-label="Weight in kilograms"
                  value={draft.weightKg}
                  onChange={set("weightKg")}
                  required
                  min={30}
                  max={250}
                />
              </div>
              <div className="appointment-tailoring-party-join-actions">
                {state.formError ? (
                  <p className="appointment-tailoring-party-error" role="alert">
                    {state.formError}
                  </p>
                ) : null}
                {isGuest ? (
                  <button
                    type="button"
                    className="appointment-tailoring-party-send is-quiet"
                    onClick={() => setSigningIn(true)}
                  >
                    Create your profile
                  </button>
                ) : null}
                <button
                  type="submit"
                  className="appointment-quick-book-button"
                  disabled={isPending}
                >
                  {isPending ? "Joining…" : "Join the party"}
                </button>
              </div>
            </form>
          )}
        </div>
        <TailoringPartyChat
          token={invite.token}
          authorName={
            joined
              ? displayName
              : `${draft.name.trim()} ${draft.surname.trim()}`.trim()
          }
          isOrganizer={false}
          blocked={
            (joined ? displayName : draft.name.trim())
              ? null
              : {
                  message: "Add your name above first.",
                  onAct: () =>
                    document
                      .querySelector<HTMLInputElement>(
                        '.appointment-tailoring-party-join input[aria-label="Name"]',
                      )
                      ?.focus(),
                }
          }
        />
      </div>

      {signingIn
        ? createPortal(
            <div
              className="appointment-sign-in-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Create your profile"
            >
              <GuestPortalPreview
                backdrop={
                  <button
                    type="button"
                    className="appointment-sign-in-backdrop"
                    aria-label="Close profile setup"
                    onClick={() => setSigningIn(false)}
                  />
                }
                {...(draft.email.trim()
                  ? { defaultEmail: draft.email.trim() }
                  : {})}
                redirectTo={`/appointments?party=${encodeURIComponent(invite.token)}`}
              />
              <button
                type="button"
                className="appointment-sign-in-close"
                aria-label="Close"
                onClick={() => setSigningIn(false)}
              >
                ×
              </button>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
