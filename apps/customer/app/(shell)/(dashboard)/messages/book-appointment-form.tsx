"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState, useState } from "react";

import { bookAppointmentFromConsultation } from "./actions";

type BookAppointmentFormState =
  | { success: false; appointmentId: null; error: null }
  | { success: true; appointmentId: string; error: null }
  | { success: false; appointmentId: null; error: string };

export function BookAppointmentForm({
  conversationId,
  isOpen: initialOpen = false,
  linkableAttachments = [],
}: {
  conversationId: string;
  isOpen?: boolean;
  linkableAttachments?: { id: string; label: string }[];
}) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [state, formAction, isPending] = useActionState(
    async (
      _prevState: BookAppointmentFormState,
      formData: FormData,
    ): Promise<BookAppointmentFormState> => {
      try {
        const result = await bookAppointmentFromConsultation(formData);
        return {
          success: true,
          appointmentId: result,
          error: null,
        };
      } catch (error) {
        return {
          success: false,
          appointmentId: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    { success: false, appointmentId: null, error: null },
  );

  if (state.success && state.appointmentId) {
    return (
      <div className="rounded-[var(--radius-md)] border border-green-200 bg-green-50 p-4">
        <p className="text-sm font-medium text-green-900">
          Appointment created! ID: {state.appointmentId}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white p-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left font-medium text-[var(--color-stone-900)] hover:text-[var(--color-stone-700)]"
      >
        {isOpen ? "✓ Close" : "+ Book an appointment from this conversation"}
      </button>

      {isOpen && (
        <form
          action={formAction}
          className="mt-3 space-y-3 border-t border-[var(--color-stone-100)] pt-3"
        >
          <input type="hidden" name="conversationId" value={conversationId} />

          <div>
            <label
              htmlFor="book-appointment-type"
              className="block text-xs font-medium text-[var(--color-stone-700)]"
            >
              Appointment type
            </label>
            <select
              id="book-appointment-type"
              name="type"
              defaultValue="styling_consultation"
              className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-2 py-2 text-sm"
            >
              <option value="styling_consultation">Styling consultation</option>
              <option value="fitting">Fitting</option>
              <option value="alteration_fitting">Alteration fitting</option>
              <option value="personal_shopping">Personal shopping</option>
              <option value="event">Event</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="book-appointment-starts-at"
              className="block text-xs font-medium text-[var(--color-stone-700)]"
            >
              Start time
            </label>
            <input
              id="book-appointment-starts-at"
              type="datetime-local"
              name="startsAt"
              required
              className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-2 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="book-appointment-ends-at"
              className="block text-xs font-medium text-[var(--color-stone-700)]"
            >
              End time
            </label>
            <input
              id="book-appointment-ends-at"
              type="datetime-local"
              name="endsAt"
              required
              className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-2 py-2 text-sm"
            />
          </div>

          {linkableAttachments.length > 0 && (
            <div>
              <label
                htmlFor="book-appointment-attachment"
                className="block text-xs font-medium text-[var(--color-stone-700)]"
              >
                Link a shared look (optional)
              </label>
              <select
                id="book-appointment-attachment"
                name="messageAttachmentId"
                defaultValue=""
                className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-2 py-2 text-sm"
              >
                <option value="">None</option>
                {linkableAttachments.map((att) => (
                  <option key={att.id} value={att.id}>
                    {att.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label
              htmlFor="book-appointment-notes"
              className="block text-xs font-medium text-[var(--color-stone-700)]"
            >
              Notes (optional)
            </label>
            <textarea
              id="book-appointment-notes"
              name="notes"
              maxLength={500}
              className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-2 py-2 text-sm"
              placeholder="Any additional details..."
            />
          </div>

          {state.error && <p className="text-xs text-red-600">{state.error}</p>}

          <Button
            type="submit"
            disabled={isPending}
            className="w-full rounded-[15px]"
          >
            {isPending ? "Creating..." : "Book Appointment"}
          </Button>
        </form>
      )}
    </div>
  );
}
