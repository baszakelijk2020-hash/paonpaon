"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { useActionState } from "react";

import { issueGuestVoucher, type IssueGuestVoucherState } from "../actions";

const initial: IssueGuestVoucherState = {};

export function GuestVoucherForm({
  weddingPartyId,
}: {
  weddingPartyId: string;
}) {
  const boundAction = issueGuestVoucher.bind(null, weddingPartyId);
  const [state, formAction, isPending] = useActionState(boundAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Voucher recipient" htmlFor="guestLabel">
          <Input
            id="guestLabel"
            name="guestLabel"
            required
            placeholder="Uncle Robert"
          />
        </FormField>
        <FormField label="Funding source" htmlFor="fundingSource">
          <Input
            id="fundingSource"
            name="fundingSource"
            required
            placeholder="Couple's gift fund"
          />
        </FormField>
        <FormField label="Value" htmlFor="valueAmount">
          <Input
            id="valueAmount"
            name="valueAmount"
            type="number"
            min={0.01}
            step="0.01"
            required
          />
        </FormField>
        <FormField label="Currency" htmlFor="currency">
          <Input
            id="currency"
            name="currency"
            defaultValue="EUR"
            maxLength={3}
            required
          />
        </FormField>
        <FormField label="Expires" htmlFor="expiresOn">
          <Input id="expiresOn" name="expiresOn" type="date" required />
        </FormField>
      </div>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      <Button
        type="submit"
        size="sm"
        disabled={isPending}
        className="self-start"
      >
        {isPending ? "Issuing…" : "Issue voucher"}
      </Button>
    </form>
  );
}
