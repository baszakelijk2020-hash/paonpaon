"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { useCallback, useState } from "react";

import {
  getAvailableSlots,
  bookAppointment,
  type GetAvailableSlotsResult,
  type GetAvailableSlotsError,
  type BookAppointmentResult,
  type BookAppointmentError,
} from "./booking-actions";

interface BookingFormProps {
  programmeId: string;
  fallbackToRequest: () => void;
}

type FormStep = "details" | "date" | "time" | "confirm" | "success";

interface FormData {
  requesterName: string;
  employeeReference?: string;
  contactEmail: string;
}

/**
 * Self-service appointment booking form for corporate office visits.
 * Visitor enters details, picks a date/time from available slots,
 * and books immediately. Falls back to lead-only request if needed.
 */
export function BookingForm({
  programmeId,
  fallbackToRequest,
}: BookingFormProps) {
  const [step, setStep] = useState<FormStep>("details");
  const [formData, setFormData] = useState<FormData>({
    requesterName: "",
    contactEmail: "",
  });
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string>("");
  const [submitError, setSubmitError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Get the user's timezone
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Validate form details
  const handleDetailsChange = useCallback(
    (field: keyof FormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    },
    [],
  );

  const validateDetails = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.requesterName.trim()) {
      errors.requesterName = "Name is required";
    } else if (formData.requesterName.trim().length > 200) {
      errors.requesterName = "Name must be 200 characters or less";
    }

    if (!formData.contactEmail.trim()) {
      errors.contactEmail = "Email is required";
    } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(formData.contactEmail)) {
      errors.contactEmail = "Enter a valid email address";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Fetch available slots when date is selected
  const handleDateSelect = useCallback(
    async (date: string) => {
      setSelectedDate(date);
      setSelectedTime("");
      setSlotsError("");
      setSlotsLoading(true);

      const result = (await getAvailableSlots(programmeId, date, timeZone)) as
        GetAvailableSlotsResult | GetAvailableSlotsError;

      setSlotsLoading(false);

      if (!result.ok) {
        setSlotsError(result.error);
        setAvailableSlots([]);
      } else {
        if (result.slots.length === 0) {
          setSlotsError("No available times on this date");
        }
        setAvailableSlots(Array.from(result.slots));
      }
    },
    [programmeId, timeZone],
  );

  // Submit the booking
  const handleBooking = useCallback(async () => {
    if (!selectedTime) {
      setSubmitError("Please select a time");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    const startsAt = selectedTime;
    // Calculate ends_at (add 60 minutes)
    const startDate = new Date(startsAt);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    const endsAt = endDate.toISOString();

    const result = (await bookAppointment(
      programmeId,
      formData.requesterName,
      startsAt,
      endsAt,
      formData.employeeReference,
      formData.contactEmail,
    )) as BookAppointmentResult | BookAppointmentError;

    setIsSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error);
    } else {
      setStep("success");
    }
  }, [selectedTime, programmeId, formData]);

  // Render step-based UI
  if (step === "success") {
    return (
      <div role="status" className="flex flex-col gap-4">
        <p className="text-sm font-medium text-[var(--color-success-600)]">
          ✓ Appointment booked
        </p>
        <p className="text-sm text-[var(--color-stone-700)]">
          Thank you — your appointment is confirmed. You will receive a
          confirmation email shortly.
        </p>
      </div>
    );
  }

  if (step === "details") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (validateDetails()) {
            setStep("date");
          }
        }}
        className="flex flex-col gap-4"
      >
        <FormField
          label="Your name"
          htmlFor="requesterName"
          error={fieldErrors.requesterName}
        >
          <Input
            id="requesterName"
            name="requesterName"
            value={formData.requesterName}
            onChange={(e) =>
              handleDetailsChange("requesterName", e.target.value)
            }
            required
            invalid={!!fieldErrors.requesterName}
          />
        </FormField>
        <FormField
          label="Employee reference (optional)"
          htmlFor="employeeReference"
        >
          <Input
            id="employeeReference"
            name="employeeReference"
            value={formData.employeeReference ?? ""}
            onChange={(e) =>
              handleDetailsChange("employeeReference", e.target.value)
            }
          />
        </FormField>
        <FormField
          label="Contact email"
          htmlFor="contactEmail"
          error={fieldErrors.contactEmail}
        >
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            value={formData.contactEmail}
            onChange={(e) =>
              handleDetailsChange("contactEmail", e.target.value)
            }
            required
            invalid={!!fieldErrors.contactEmail}
          />
        </FormField>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={fallbackToRequest}>
            Just request a visit
          </Button>
          <Button type="submit">Next: Pick a time</Button>
        </div>
      </form>
    );
  }

  if (step === "date") {
    // Render a simple date input (HTML5 date picker)
    // In a real app, might use a calendar component
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (selectedDate) {
            handleDateSelect(selectedDate);
            setStep("time");
          }
        }}
        className="flex flex-col gap-4"
      >
        <FormField label="Select a date" htmlFor="dateInput">
          <Input
            id="dateInput"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            max={
              new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0]
            }
            required
          />
        </FormField>
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep("details")}
          >
            Back
          </Button>
          <Button type="submit" disabled={!selectedDate}>
            Next: Pick a time
          </Button>
        </div>
      </form>
    );
  }

  if (step === "time") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setStep("confirm");
        }}
        className="flex flex-col gap-4"
      >
        <p className="text-sm text-[var(--color-stone-600)]">
          {selectedDate && new Date(selectedDate).toLocaleDateString()}
        </p>

        {slotsLoading && (
          <p className="text-sm text-[var(--color-stone-500)]">
            Loading available times…
          </p>
        )}

        {slotsError && !slotsLoading && (
          <p role="alert" className="text-sm text-[var(--color-danger-500)]">
            {slotsError}
          </p>
        )}

        {availableSlots.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {availableSlots.map((slot) => {
              const time = new Date(slot).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone,
              });
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setSelectedTime(slot)}
                  className={`rounded-[var(--radius-md)] border-2 p-3 text-sm font-medium transition-all ${
                    selectedTime === slot
                      ? "border-[var(--color-primary-500)] bg-[var(--color-primary-50)] text-[var(--color-primary-900)]"
                      : "border-[var(--color-stone-200)] bg-white hover:border-[var(--color-stone-300)]"
                  }`}
                >
                  {time}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setStep("date");
              setSelectedDate("");
            }}
          >
            Back
          </Button>
          <Button type="submit" disabled={!selectedTime || slotsLoading}>
            Confirm booking
          </Button>
        </div>
      </form>
    );
  }

  if (step === "confirm") {
    const selectedDateTime = new Date(selectedTime);
    const dateStr = selectedDateTime.toLocaleDateString();
    const timeStr = selectedDateTime.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    });

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleBooking();
        }}
        className="flex flex-col gap-4"
      >
        <div className="space-y-3 rounded-[var(--radius-md)] bg-[var(--color-stone-50)] p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-[var(--color-stone-600)]">
              Name
            </p>
            <p className="mt-1 text-sm text-[var(--color-stone-900)]">
              {formData.requesterName}
            </p>
          </div>
          {formData.employeeReference && (
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-[var(--color-stone-600)]">
                Employee Reference
              </p>
              <p className="mt-1 text-sm text-[var(--color-stone-900)]">
                {formData.employeeReference}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-[var(--color-stone-600)]">
              Email
            </p>
            <p className="mt-1 text-sm text-[var(--color-stone-900)]">
              {formData.contactEmail}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-[var(--color-stone-600)]">
              Appointment
            </p>
            <p className="mt-1 text-sm text-[var(--color-stone-900)]">
              {dateStr} at {timeStr}
            </p>
          </div>
        </div>

        {submitError && (
          <p role="alert" className="text-sm text-[var(--color-danger-500)]">
            {submitError}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep("time")}
            disabled={isSubmitting}
          >
            Back
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Booking…" : "Confirm booking"}
          </Button>
        </div>
      </form>
    );
  }

  return null;
}
