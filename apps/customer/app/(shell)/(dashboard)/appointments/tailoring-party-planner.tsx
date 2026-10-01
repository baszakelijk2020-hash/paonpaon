"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { GuestPortalPreview } from "../guest-portal-preview";
import { prepareTailoringPartyInvite } from "../wedding-parties/actions";

import { bookAppointment } from "./booking-actions";
import type { BookableBranch } from "./booking-flow";
import { LocationFinder } from "./location-finder";
import { cancelMyAppointment, rescheduleMyAppointment } from "./manage-actions";
import {
  HALF_HOUR_SLOTS,
  MiniCalendar,
  QuickBookField,
  formatDateLabel,
  zonedISO,
  zonedWallTime,
} from "./quick-book-bar";
import { TailoringPartyChat } from "./tailoring-party-chat";
import {
  TailoringPartyEntry,
  initialsOf,
  type OrbitCenter,
  type OrbitSeat,
} from "./tailoring-party-orbit";

type OpenField = "date" | "time" | "party" | "occasion" | "location" | null;

const OCCASIONS = [
  { value: "wedding", label: "Wedding" },
  { value: "office", label: "Office" },
  { value: "friends", label: "Friends" },
  { value: "none", label: "No occasion" },
] as const;

type Occasion = (typeof OCCASIONS)[number]["value"];

/** The most people the orbit seats: you in the middle, seven around you. */
const MAX_PARTY = 8;

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type MemberStatus = "invited" | "scheduled" | "fitted" | "completed";

export type TailoringPartyMember = {
  readonly name: string;
  readonly photoUrl?: string;
  readonly status: MemberStatus;
  /** Absent means coming to the group fitting. */
  readonly attendance?: "declined" | "rebooked";
};

/** One pill per person in the organizer's status column. */
function memberPill(member: TailoringPartyMember): {
  label: string;
  tone: string;
} {
  if (member.attendance === "declined") {
    return { label: "Cancelled", tone: "is-cancelled" };
  }
  if (member.attendance === "rebooked" || member.status === "scheduled") {
    return { label: "Rebooked", tone: "is-rebooked" };
  }
  if (member.status === "fitted") return { label: "Fitted", tone: "is-fitted" };
  if (member.status === "completed") {
    return { label: "Waiting for pick-up", tone: "is-pickup" };
  }
  return { label: "Invited", tone: "is-invited" };
}

/** The organizer's booked party fitting, read back from their appointments. */
export type TailoringPartyBooking = {
  readonly appointmentId: string;
  readonly startsAt: string;
  readonly branchId?: string;
  readonly notes?: string;
};

type Guest = {
  name: string;
  email: string;
  photoUrl?: string;
  sent: boolean;
  editing: boolean;
};

const EMPTY_GUEST: Guest = { name: "", email: "", sent: false, editing: false };

/** The appointment's notes lead with this, so the booking can be found again. */
const PARTY_NOTE = "Tailoring party";

function parseBooking(
  booking: TailoringPartyBooking | null,
  branches: readonly BookableBranch[],
) {
  if (!booking) return null;
  const wall = zonedWallTime(
    booking.startsAt,
    branches.find((branch) => branch.id === booking.branchId)?.timezone,
  );
  const size = Number(booking.notes?.match(/Party of (\d+)/)?.[1]);
  const occasionLabel = booking.notes?.match(
    /Occasion: ([A-Za-z ]+?)(?: ·|$)/,
  )?.[1];
  const occasion =
    OCCASIONS.find((option) => option.label === occasionLabel)?.value ?? null;
  return {
    date: wall.date,
    time: wall.time,
    partySize:
      Number.isInteger(size) && size >= 2 ? Math.min(size, MAX_PARTY) : null,
    occasion,
    branchId: booking.branchId ?? null,
  };
}

/**
 * The Tailoring Party: the same date, time, people, occasion and location
 * pills as the booking bar at the top of the page (no Today / Tomorrow: a
 * party is planned ahead), and under them two cards — the orbit of seats,
 * and the party itself: the organizer and one line per guest, with a photo
 * the organizer can add for anyone, and a settings menu per person.
 *
 * Book sends the party fitting to the atelier as a real appointment — the
 * same request every booking on this page makes, so it lands in the
 * atelier's agenda and in this one alike. Once booked the button reads
 * Booked; changing the day, time, people, occasion or location turns it into
 * Save changes, which reschedules the appointment (or, when more than the
 * time changed, replaces it).
 *
 * Everything can be filled in without an account; booking and inviting ask
 * a guest to sign in with the Wardrobe's own sign-in card (Apple, Google,
 * email), popped up over the page so they keep their place.
 */
export function TailoringPartyPlanner({
  href,
  retailerId,
  partyId,
  centerName,
  members,
  branches,
  booking,
  inviteToken,
  isGuest,
}: {
  /** The party's own page, or the page that starts one. */
  href: string;
  retailerId: string;
  /** The client's existing party, if they organize one. */
  partyId: string | null;
  /** "You" for a guest, the client's name when signed in. */
  centerName: string;
  /** People already in the party, in seat order. */
  members: readonly TailoringPartyMember[];
  /** The atelier's locations. */
  branches: readonly BookableBranch[];
  booking: TailoringPartyBooking | null;
  /** The organizer's party link token, which also opens its chat. */
  inviteToken: string | null;
  isGuest: boolean;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const booked = parseBooking(booking, branches);
  const [date, setDate] = useState(booked?.date ?? "");
  const [time, setTime] = useState(booked?.time ?? "10:00");
  const [partySize, setPartySize] = useState(() =>
    Math.min(MAX_PARTY, Math.max(booked?.partySize ?? 6, members.length + 1)),
  );
  const [occasion, setOccasion] = useState<Occasion | null>(
    booked?.occasion ?? null,
  );
  const [branchId, setBranchId] = useState<string>(
    booked?.branchId ?? branches[0]?.id ?? "",
  );
  const [openField, setOpenField] = useState<OpenField>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [partyToken, setPartyToken] = useState<string | null>(inviteToken);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [hostPhoto, setHostPhoto] = useState<string | undefined>();
  const [menuFor, setMenuFor] = useState<
    number | "host" | `member-${number}` | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, startBusy] = useTransition();
  const [bookedAppointment, setBookedAppointment] = useState<{
    id: string;
    snapshot: string;
  } | null>(null);

  const snapshot = JSON.stringify({
    date,
    time,
    partySize,
    occasion,
    branchId,
  });
  // The booking the page was loaded with counts as booked as it was loaded.
  const [initialSnapshot] = useState(snapshot);
  const current =
    bookedAppointment ??
    (booking ? { id: booking.appointmentId, snapshot: initialSnapshot } : null);
  const bookLabel = !current
    ? "Book"
    : current.snapshot === snapshot
      ? "Booked"
      : "Save changes";

  useEffect(() => {
    if (!signingIn) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSigningIn(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [signingIn]);

  // As in the booking bar: a click elsewhere or Escape closes an open pill.
  useEffect(() => {
    if (!openField) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpenField(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenField(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openField]);

  // A settings menu closes on any click outside it, or Escape.
  useEffect(() => {
    if (menuFor === null) return;
    const onPointerDown = (event: PointerEvent) => {
      if (
        !(event.target as Element).closest(
          ".tp-person-menu, .tp-person-settings",
        )
      ) {
        setMenuFor(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuFor(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuFor]);

  // One line per open seat: the party size less you and whoever has joined.
  const openSeats = Math.max(0, partySize - 1 - members.length);
  const guestRows = Array.from(
    { length: openSeats },
    (_, i) => guests[i] ?? EMPTY_GUEST,
  );
  // Seats that are going keep their line a moment longer, so they can fade
  // out rather than vanish; new ones fade in on their own.
  const [shownSeats, setShownSeats] = useState(openSeats);
  useEffect(() => {
    if (openSeats >= shownSeats) {
      setShownSeats(openSeats);
      return;
    }
    const timer = window.setTimeout(() => setShownSeats(openSeats), 260);
    return () => window.clearTimeout(timer);
  }, [openSeats, shownSeats]);
  const renderedRows = Array.from(
    { length: Math.max(openSeats, shownSeats) },
    (_, i) => guests[i] ?? EMPTY_GUEST,
  );
  const updateGuest = (index: number, patch: Partial<Guest>) =>
    setGuests((list) => {
      const next = Array.from(
        { length: Math.max(list.length, index + 1) },
        (_, i) => list[i] ?? EMPTY_GUEST,
      );
      next[index] = { ...next[index]!, ...patch };
      return next;
    });
  const isReady = (guest: Guest) =>
    guest.name.trim() !== "" && EMAIL_PATTERN.test(guest.email.trim());
  const unsent = guestRows.filter((guest) => isReady(guest) && !guest.sent);
  const progressPeople = [
    { name: centerName, stage: "Booked", step: 0 },
    ...members.map((member) => {
      const pill = memberPill(member);
      return {
        name: member.name,
        stage: pill.label,
        step:
          pill.tone === "is-complete" ? 3 : pill.tone === "is-invited" ? 1 : 2,
      };
    }),
    ...renderedRows.map((guest, index) => ({
      name: guest.name.trim() || `Guest ${members.length + index + 2}`,
      stage: guest.sent
        ? "Invitation sent"
        : isReady(guest)
          ? "Ready to invite"
          : "Details needed",
      step: guest.sent ? 1 : 0,
    })),
  ];

  const center = useMemo<OrbitCenter>(
    () => ({
      label: centerName,
      ...(hostPhoto ? { photoUrl: hostPhoto } : {}),
    }),
    [centerName, hostPhoto],
  );
  const seats = useMemo<OrbitSeat[]>(() => {
    const joined = members.map((member): OrbitSeat => ({
      text: initialsOf(member.name),
      filled: true,
      label: member.name.split(/\s+/)[0] ?? member.name,
      ...(member.photoUrl ? { photoUrl: member.photoUrl } : {}),
    }));
    const open = guestRows.map((guest, i): OrbitSeat => {
      const named = guest.name.trim() !== "";
      return {
        text: named ? initialsOf(guest.name) : String(members.length + i + 2),
        filled: named || Boolean(guest.photoUrl),
        ...(named ? { label: guest.name.trim().split(/\s+/)[0]! } : {}),
        ...(guest.photoUrl ? { photoUrl: guest.photoUrl } : {}),
      };
    });
    return [...joined, ...open];
  }, [members, guestRows]);

  const toggle = (field: Exclude<OpenField, null>) =>
    setOpenField((open) => (open === field ? null : field));

  const occasionLabel = OCCASIONS.find(
    (option) => option.value === occasion,
  )?.label;
  const branchName = branches.find((branch) => branch.id === branchId)?.name;
  const branchAddress = branches.find(
    (branch) => branch.id === branchId,
  )?.address;

  const partyNotes = () =>
    [
      PARTY_NOTE,
      occasionLabel && occasion !== "none" ? `Occasion: ${occasionLabel}` : "",
      `Party of ${partySize}`,
      guestRows.some(isReady)
        ? `Guests: ${guestRows
            .filter(isReady)
            .map((guest) => `${guest.name.trim()} (${guest.email.trim()})`)
            .join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 900);

  const startsAtISO = () =>
    zonedISO(
      date,
      time,
      branches.find((branch) => branch.id === branchId)?.timezone,
    );

  const book = () => {
    if (isGuest) {
      setSigningIn(true);
      return;
    }
    if (bookLabel === "Booked") return;
    if (!date) {
      setOpenField("date");
      return;
    }
    setError(null);
    startBusy(async () => {
      const startsAt = startsAtISO();
      const endsAt = new Date(Date.parse(startsAt) + 60 * 60_000).toISOString();
      const previous = current ? JSON.parse(current.snapshot) : null;
      const onlyTimeChanged =
        current &&
        previous &&
        previous.partySize === partySize &&
        previous.occasion === occasion &&
        previous.branchId === branchId;

      if (current && onlyTimeChanged) {
        const form = new FormData();
        form.set("appointmentId", current.id);
        form.set("startsAt", startsAt);
        form.set("endsAt", endsAt);
        const result = await rescheduleMyAppointment({}, form);
        if (!result.ok) {
          setError(result.formError ?? "That could not be changed.");
          return;
        }
        // Invitees see the party's own date and time; keep it in step.
        await prepareTailoringPartyInvite({
          retailerId,
          ...(partyId ? { partyId } : {}),
          eventDate: date,
          eventTime: time,
          ...(branchName ? { fittingLocation: branchName } : {}),
          notes: partyNotes(),
        });
        setBookedAppointment({ id: current.id, snapshot });
        router.refresh();
        return;
      }

      if (current) {
        const cancel = new FormData();
        cancel.set("appointmentId", current.id);
        cancel.set(
          "reason",
          "Tailoring party details changed by the organizer",
        );
        const cancelled = await cancelMyAppointment({}, cancel);
        if (!cancelled.ok) {
          setError(cancelled.formError ?? "That could not be changed.");
          return;
        }
      }

      const form = new FormData();
      form.set("retailerId", retailerId);
      form.set("reason", "service_size_check");
      if (branchId) form.set("branchId", branchId);
      form.set("startsAt", startsAt);
      form.set("notes", partyNotes());
      const result = await bookAppointment({ fieldErrors: {} }, form);
      if (!result.success || !result.appointmentId) {
        setError(
          result.formError ??
            Object.values(result.fieldErrors)[0] ??
            "The fitting could not be booked.",
        );
        return;
      }
      // The party itself, so there is a join link to share.
      const party = await prepareTailoringPartyInvite({
        retailerId,
        ...(partyId ? { partyId } : {}),
        eventDate: date,
        eventTime: time,
        ...(branchName ? { fittingLocation: branchName } : {}),
        notes: partyNotes(),
      });
      if (party.formError) {
        setError(
          `Booked, but the party could not be updated: ${party.formError}`,
        );
      }
      setBookedAppointment({ id: result.appointmentId, snapshot });
      router.refresh();
    });
  };

  /** Opens the organizer's mail app addressed to these guests. */
  const invite = (targets: Guest[]) => {
    if (isGuest) {
      setSigningIn(true);
      return;
    }
    if (targets.length === 0) return;
    setError(null);
    startBusy(async () => {
      const result = await prepareTailoringPartyInvite({
        retailerId,
        ...(partyId ? { partyId } : {}),
        ...(date ? { eventDate: date } : {}),
        eventTime: time,
        ...(branchName ? { fittingLocation: branchName } : {}),
        notes: partyNotes(),
      });
      if (!result.inviteUrl) {
        setError(result.formError ?? "The invite could not be prepared.");
        return;
      }
      const when = date
        ? `on ${formatDateLabel(date)} at ${time}${branchName ? ` in ${branchName}` : ""}`
        : `at ${time} (the date is still to be set)`;
      const body = [
        `Hi ${targets.map((guest) => guest.name.trim().split(/\s+/)[0]).join(", ")},`,
        "",
        `I'm getting suited up at Nebel & Spiegel${
          occasionLabel && occasion !== "none"
            ? ` for ${occasion === "office" ? "the office" : `a ${occasionLabel.toLowerCase()}`}`
            : ""
        } and would like you with me — our fitting is ${when}.`,
        "",
        "Join the party and set up your own profile here:",
        result.inviteUrl,
      ].join("\n");
      window.location.href = `mailto:${targets
        .map((guest) => guest.email.trim())
        .join(",")}?subject=${encodeURIComponent(
        "Join my tailoring party",
      )}&body=${encodeURIComponent(body)}`;
      setGuests((list) =>
        list.map((guest) =>
          targets.some(
            (target) =>
              target.email === guest.email && target.name === guest.name,
          )
            ? { ...guest, sent: true, editing: false }
            : guest,
        ),
      );
      router.refresh();
    });
  };

  const pickPhoto = (file: File | undefined, apply: (url: string) => void) => {
    if (!file || !file.type.startsWith("image/")) return;
    apply(URL.createObjectURL(file));
  };

  return (
    <>
      <div
        ref={containerRef}
        className="appointment-quick-book-container appointment-tailoring-party-bar"
      >
        <div
          className="appointment-quick-book-bar"
          data-open={openField ?? undefined}
        >
          <QuickBookField
            label={date ? formatDateLabel(date) : "dd / mm / yyyy"}
            placeholder={!date}
            open={openField === "date"}
            onToggle={() => toggle("date")}
            drawerLabel="Choose a date"
            grow={1}
          >
            <MiniCalendar
              value={date}
              onSelect={(next) => {
                setDate(next);
                setOpenField(null);
              }}
            />
          </QuickBookField>

          <QuickBookField
            label={time}
            open={openField === "time"}
            onToggle={() => toggle("time")}
            drawerLabel="Choose a time"
            grow={0.6}
          >
            <div className="appointment-quick-book-options">
              {HALF_HOUR_SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className="appointment-quick-book-option"
                  aria-pressed={slot === time}
                  onClick={() => {
                    setTime(slot);
                    setOpenField(null);
                  }}
                >
                  {slot}
                </button>
              ))}
            </div>
          </QuickBookField>

          <QuickBookField
            label={`${partySize} people`}
            grow={0.7}
            open={openField === "party"}
            onToggle={() => toggle("party")}
            drawerLabel="How many people"
          >
            <div className="appointment-quick-book-options">
              {Array.from({ length: MAX_PARTY - 1 }, (_, i) => i + 2).map(
                (size) => (
                  <button
                    key={size}
                    type="button"
                    className="appointment-quick-book-option"
                    aria-pressed={size === partySize}
                    disabled={size < members.length + 1}
                    onClick={() => {
                      setPartySize(size);
                      setOpenField(null);
                    }}
                  >
                    {`${size} people`}
                  </button>
                ),
              )}
            </div>
          </QuickBookField>

          <QuickBookField
            label={occasionLabel ?? "Occasion"}
            placeholder={!occasion}
            open={openField === "occasion"}
            onToggle={() => toggle("occasion")}
            drawerLabel="Occasion"
          >
            <div className="appointment-quick-book-options">
              {OCCASIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="appointment-quick-book-option"
                  aria-pressed={option.value === occasion}
                  onClick={() => {
                    setOccasion(option.value);
                    setOpenField(null);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </QuickBookField>

          {branches.length > 0 ? (
            <QuickBookField
              label={branchName ?? "Location"}
              grow={1.7}
              {...(branchAddress ? { sublabel: branchAddress } : {})}
              placeholder={!branchName}
              open={openField === "location"}
              onToggle={() => toggle("location")}
              drawerLabel="Location"
            >
              <LocationFinder
                branches={branches}
                selectedBranchId={branchId}
                onSelect={(branch) => {
                  setBranchId(branch.id);
                  setOpenField(null);
                }}
              />
            </QuickBookField>
          ) : null}

          <button
            type="button"
            onClick={book}
            disabled={isBusy || bookLabel === "Booked"}
            data-state={bookLabel === "Booked" ? "booked" : undefined}
            className="appointment-quick-book-button"
          >
            {isBusy ? "…" : bookLabel}
          </button>
        </div>
      </div>

      <div className="appointment-tailoring-party-cards">
        <div className="appointment-tailoring-party-card appointment-tailoring-party-orbit-card">
          <TailoringPartyEntry
            href={href}
            center={center}
            seats={seats}
            onOpen={(event) => {
              if (!isGuest) return;
              event.preventDefault();
              setSigningIn(true);
            }}
          />
        </div>

        <div className="appointment-tailoring-party-card appointment-tailoring-party-invites">
          <div className="appointment-tailoring-party-invites-head">
            <div>
              <p>After booking</p>
              <h3>Invite your party</h3>
            </div>
            <span className="appointment-tailoring-party-live">
              <i /> {Math.max(partySize - 1, 1)} guest
              {partySize === 2 ? "" : "s"}
            </span>
          </div>
          <ol className="appointment-tailoring-party-people">
            <li>
              <PhotoSeat
                inputId="tp-host-photo"
                label="Add your photo"
                photoUrl={hostPhoto}
                onPick={(file) => pickPhoto(file, setHostPhoto)}
              >
                <AvatarIcon />
              </PhotoSeat>
              <span className="appointment-tailoring-party-person">
                {centerName}
              </span>
              <PersonSettings
                open={menuFor === "host"}
                onToggle={() =>
                  setMenuFor((open) => (open === "host" ? null : "host"))
                }
                items={[
                  {
                    label: "Change details",
                    disabled: true,
                    onSelect: () => undefined,
                  },
                  {
                    label: hostPhoto ? "Change photo" : "Add photo",
                    onSelect: () => {
                      setMenuFor(null);
                      document.getElementById("tp-host-photo")?.click();
                    },
                  },
                  {
                    label: "Resend invitation",
                    disabled: true,
                    onSelect: () => undefined,
                  },
                  {
                    label: "Remove from party",
                    danger: true,
                    disabled: true,
                    onSelect: () => undefined,
                  },
                  {
                    label: "Reschedule participant",
                    disabled: true,
                    onSelect: () => undefined,
                  },
                ]}
              />
            </li>
            {members.map((member, index) => (
              <li key={`member-${index}`}>
                <span className="appointment-tailoring-party-seat">
                  {member.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.photoUrl} alt="" />
                  ) : (
                    initialsOf(member.name)
                  )}
                </span>
                <span className="appointment-tailoring-party-person">
                  <span>{member.name}</span>
                  <span
                    className={`appointment-tailoring-party-status ${memberPill(member).tone}`}
                  >
                    {memberPill(member).label}
                  </span>
                </span>
                <PersonSettings
                  open={menuFor === `member-${index}`}
                  onToggle={() =>
                    setMenuFor((open) =>
                      open === `member-${index}` ? null : `member-${index}`,
                    )
                  }
                  items={[
                    {
                      label: "Change details",
                      disabled: true,
                      onSelect: () => undefined,
                    },
                    {
                      label: "Resend invitation",
                      disabled: true,
                      onSelect: () => undefined,
                    },
                    {
                      label: "Remove from party",
                      danger: true,
                      disabled: true,
                      onSelect: () => undefined,
                    },
                    {
                      label: "Reschedule participant",
                      disabled: true,
                      onSelect: () => undefined,
                    },
                  ]}
                />
              </li>
            ))}
            {renderedRows.map((guest, index) => {
              const locked = guest.sent && !guest.editing;
              const seatNumber = members.length + index + 2;
              const leaving = index >= openSeats;
              return (
                <li
                  key={`seat-${index}`}
                  className={leaving ? "is-leaving" : undefined}
                  aria-hidden={leaving || undefined}
                >
                  <PhotoSeat
                    label={`Add a photo for guest ${index + 1}`}
                    photoUrl={guest.photoUrl}
                    open={!guest.name.trim() && !guest.photoUrl}
                    onPick={(file) =>
                      pickPhoto(file, (url) =>
                        updateGuest(index, { photoUrl: url }),
                      )
                    }
                  >
                    {guest.name.trim() ? initialsOf(guest.name) : seatNumber}
                  </PhotoSeat>
                  <input
                    type="text"
                    className="appointment-tailoring-party-input"
                    placeholder="Name"
                    aria-label={`Guest ${index + 1} name and surname`}
                    value={guest.name}
                    maxLength={200}
                    readOnly={locked}
                    onChange={(event) =>
                      updateGuest(index, { name: event.target.value })
                    }
                  />
                  {/* The status rides inside the email pill, at its end, so the
                      name and email keep the line's full width. */}
                  <span className="tp-field-with-status">
                    <input
                      type="email"
                      className="appointment-tailoring-party-input"
                      placeholder="Email"
                      aria-label={`Guest ${index + 1} email`}
                      value={guest.email}
                      maxLength={254}
                      readOnly={locked}
                      data-has-status={
                        guest.sent || isReady(guest) || undefined
                      }
                      onChange={(event) =>
                        updateGuest(index, { email: event.target.value })
                      }
                    />
                    {guest.sent ? (
                      <span className="appointment-tailoring-party-status is-invited">
                        Invited
                      </span>
                    ) : isReady(guest) ? (
                      <span className="appointment-tailoring-party-status is-draft">
                        Not sent
                      </span>
                    ) : null}
                  </span>
                  <PersonSettings
                    open={menuFor === index}
                    onToggle={() =>
                      setMenuFor((open) => (open === index ? null : index))
                    }
                    items={[
                      {
                        label: "Change details",
                        onSelect: () => {
                          setMenuFor(null);
                          updateGuest(index, { editing: true });
                        },
                      },
                      {
                        label: "Resend invitation",
                        disabled: !isReady(guest),
                        onSelect: () => {
                          setMenuFor(null);
                          invite([guest]);
                        },
                      },
                      {
                        label: "Remove from party",
                        danger: true,
                        disabled: partySize <= 2,
                        onSelect: () => {
                          setMenuFor(null);
                          setGuests((list) =>
                            list.filter((_, i) => i !== index),
                          );
                          setPartySize((size) => Math.max(2, size - 1));
                        },
                      },
                      {
                        label: "Reschedule participant",
                        disabled: true,
                        onSelect: () => undefined,
                      },
                    ]}
                  />
                </li>
              );
            })}
          </ol>

          {error ? (
            <p className="appointment-tailoring-party-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="appointment-tailoring-party-invites-foot">
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <button
              type="button"
              className="appointment-tailoring-party-send"
              onClick={() => invite(unsent)}
              disabled={!isGuest && (unsent.length === 0 || isBusy)}
            >
              {unsent.length > 1
                ? `Send ${unsent.length} invites`
                : "Send invite"}
            </button>
          </div>
        </div>

        <section
          className="appointment-tailoring-party-card tp-party-progress"
          aria-labelledby="tp-party-progress-title"
        >
          <div className="appointment-tailoring-party-invites-head">
            <div>
              <p>Party readiness</p>
              <h3 id="tp-party-progress-title">Everyone&rsquo;s progress</h3>
            </div>
            <span className="appointment-tailoring-party-live">
              <i /> Live
            </span>
          </div>
          <div
            className="tp-party-progress-stages"
            aria-label="Progress stages"
          >
            <span>
              <b>01</b> Details
            </span>
            <span>
              <b>02</b> Invited
            </span>
            <span>
              <b>03</b> Fitting
            </span>
            <span>
              <b>04</b> Ready
            </span>
          </div>
          <ol className="tp-party-progress-list">
            {progressPeople.map((person, index) => (
              <li key={`${person.name}-${index}`}>
                <div>
                  <span>{person.name}</span>
                  <small>{person.stage}</small>
                </div>
                <div
                  className="tp-party-progress-track"
                  aria-label={`${person.name}: ${person.stage}`}
                >
                  <i style={{ width: `${(person.step / 3) * 100}%` }} />
                  {[0, 1, 2, 3].map((stage) => (
                    <b
                      key={stage}
                      className={
                        stage <= person.step ? "is-reached" : undefined
                      }
                    />
                  ))}
                </div>
                <span className="tp-party-progress-step">
                  {person.step + 1}/4
                </span>
              </li>
            ))}
          </ol>
        </section>

        <TailoringPartyChat
          token={partyToken}
          authorName={centerName}
          isOrganizer
          ensureToken={async () => {
            const result = await prepareTailoringPartyInvite({
              retailerId,
              ...(date ? { eventDate: date } : {}),
              eventTime: time,
              ...(branchName ? { fittingLocation: branchName } : {}),
              notes: partyNotes(),
            });
            if (result.inviteToken) setPartyToken(result.inviteToken);
            return result.inviteToken ?? null;
          }}
          blocked={
            isGuest
              ? {
                  message: "Sign in to start the party chat.",
                  onAct: () => setSigningIn(true),
                }
              : null
          }
        />
      </div>

      {signingIn
        ? /* Portalled to the body: the shell keeps a transform after its
             entrance, which would pin a fixed overlay to the shell instead
             of the window. */
          createPortal(
            <div
              className="appointment-sign-in-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Sign in"
            >
              <GuestPortalPreview
                backdrop={
                  <button
                    type="button"
                    className="appointment-sign-in-backdrop"
                    aria-label="Close sign in"
                    onClick={() => setSigningIn(false)}
                  />
                }
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
    </>
  );
}

function AvatarIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6" />
    </svg>
  );
}

/** A seat that takes a photo when clicked. */
function PhotoSeat({
  inputId,
  label,
  photoUrl,
  open = false,
  onPick,
  children,
}: {
  inputId?: string;
  label: string;
  photoUrl: string | undefined;
  open?: boolean;
  onPick: (file: File | undefined) => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={[
        "appointment-tailoring-party-seat",
        "is-photo-pick",
        open ? "is-open" : "",
      ].join(" ")}
      title={label}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" />
      ) : (
        children
      )}
      <input
        {...(inputId ? { id: inputId } : {})}
        type="file"
        accept="image/*"
        aria-label={label}
        onChange={(event) => {
          onPick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </label>
  );
}

/** Three dots in their own squircle at the end of a person's line, and
 * its menu. */
function PersonSettings({
  open,
  onToggle,
  items,
}: {
  open: boolean;
  onToggle: () => void;
  items: readonly {
    label: string;
    onSelect: () => void;
    disabled?: boolean;
    danger?: boolean;
  }[];
}) {
  return (
    <span className="tp-person-settings-wrap">
      <button
        type="button"
        className="tp-person-settings"
        aria-label="Options"
        aria-expanded={open}
        onClick={onToggle}
      >
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="13" cy="8" r="1.5" />
        </svg>
      </button>
      {open ? (
        <span className="tp-person-menu" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={item.danger ? "is-danger" : undefined}
              onClick={item.onSelect}
            >
              {item.label}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}
