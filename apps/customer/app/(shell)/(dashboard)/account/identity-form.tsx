"use client";

import type { Customer } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import Image from "next/image";
import { useActionState, useRef, useState } from "react";

import { updateProfileDetails, type IdentityFormState } from "./actions";

interface IdentityFormProps {
  retailerId: string;
  customer: Customer;
}

function getInitials(fullName: string): string {
  return fullName
    .split(" ")
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join("");
}

export function IdentityForm({ retailerId, customer }: IdentityFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    customer.profilePhotoUrl || null,
  );
  const [photoError, setPhotoError] = useState<string>("");

  const initialState: IdentityFormState = {
    fieldErrors: {},
  };

  const [state, formAction, isPending] = useActionState(
    updateProfileDetails,
    initialState,
  );

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhotoError("Use a JPEG, PNG or WEBP photo.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setPhotoError("Photo must be 10 MB or smaller.");
      return;
    }

    setPhotoError("");

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <section
      className="pe-card rounded-[32px] bg-[#191b1d] p-7 text-white"
      data-pe-card
    >
      <p className="customer-kicker text-white/55">Your identity</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
        Profile details
      </h2>

      <form action={formAction} className="mt-6 flex flex-col gap-6">
        <input type="hidden" name="retailerId" value={retailerId} />

        {/* Profile photo */}
        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold">Profile photo</span>
          <button
            type="button"
            onClick={handlePhotoClick}
            className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          >
            {photoPreview ? (
              <Image
                src={photoPreview}
                alt="Profile photo preview"
                width={96}
                height={96}
                className="h-full w-full rounded-full object-cover"
                unoptimized
              />
            ) : (
              <span className="text-3xl font-bold text-white/60">
                {getInitials(customer.fullName)}
              </span>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoSelect}
            className="hidden"
            aria-label="Upload profile photo"
          />
          <p className="text-xs text-white/60">
            Click to upload a new photo (JPEG, PNG or WEBP)
          </p>
          {photoError && (
            <p role="alert" className="text-xs text-[#ff6b6b]">
              {photoError}
            </p>
          )}
        </div>

        {/* Form errors */}
        {state.formError ? (
          <p role="alert" className="text-sm text-[#ff6b6b]">
            {state.formError}
          </p>
        ) : null}
        {state.success ? (
          <p role="status" className="text-sm text-[#90ee90]">
            Profile updated.
          </p>
        ) : null}

        {/* Full name */}
        <FormField
          label="Full name"
          htmlFor={`fullName-${retailerId}`}
          error={state.fieldErrors["fullName"]}
        >
          <Input
            id={`fullName-${retailerId}`}
            name="fullName"
            type="text"
            defaultValue={customer.fullName}
            required
            className="bg-white/10 text-white placeholder:text-white/40 focus:bg-white/20"
          />
        </FormField>

        {/* Date of birth */}
        <FormField
          label="Date of birth (optional)"
          htmlFor={`dateOfBirth-${retailerId}`}
          error={state.fieldErrors["dateOfBirth"]}
        >
          <Input
            id={`dateOfBirth-${retailerId}`}
            name="dateOfBirth"
            type="date"
            defaultValue={customer.dateOfBirth ?? ""}
            className="bg-white/10 text-white placeholder:text-white/40 focus:bg-white/20"
          />
        </FormField>

        {/* Submit button */}
        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
    </section>
  );
}
