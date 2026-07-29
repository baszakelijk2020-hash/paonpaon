"use client";

import { useActionState, useEffect } from "react";

import { uploadBrandAsset, type BrandAssetActionState } from "./actions";

const initialState: BrandAssetActionState = {};

type AssetRole = "garment" | "logoUrl" | "faviconUrl" | "heroImageUrl";

function fillThemeField(name: AssetRole, url: string) {
  if (name === "garment") return false;
  const field = document.querySelector<HTMLInputElement>(
    `input[name="${name}"]`,
  );
  if (!field) return false;
  field.value = url;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

function appendGarmentPhotoUrl(url: string) {
  const field = document.querySelector<HTMLTextAreaElement>(
    'textarea[name="productImageUrls"]',
  );
  if (!field) return false;
  const lines = field.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.includes(url)) return true;
  if (lines.length >= 24) return false;
  field.value = [...lines, url].join("\n");
  field.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

function applyUploadedUrl(url: string, role: AssetRole) {
  if (role === "garment") return appendGarmentPhotoUrl(url);
  return fillThemeField(role, url);
}

export function BrandAssetUploader({ prospectId }: { prospectId: string }) {
  const action = uploadBrandAsset.bind(null, prospectId);
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (!state.publicUrl) return;
    const role = (state.role as AssetRole | undefined) ?? "garment";
    applyUploadedUrl(state.publicUrl, role);
  }, [state.publicUrl, state.role]);

  return (
    <section className="rounded-[var(--radius-md)] border bg-white p-6 sm:p-8">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
        Brand asset library
      </p>
      <p className="mt-3 text-sm text-[var(--color-stone-500)]">
        Upload once, choose where it lands. Garment photos append to the list
        below; logo, favicon and hero fill the theme fields. Save the
        configuration after uploading.
      </p>
      <form
        action={formAction}
        className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <label className="text-sm">
          Use as
          <select
            className="mt-1 block min-h-11 w-full rounded-md border px-3 sm:w-48"
            name="assetRole"
            defaultValue="garment"
          >
            <option value="garment">Garment photo</option>
            <option value="logoUrl">Logo</option>
            <option value="faviconUrl">Favicon</option>
            <option value="heroImageUrl">Hero image</option>
          </select>
        </label>
        <input
          type="file"
          name="asset"
          accept="image/jpeg,image/png,image/webp,image/svg+xml,image/x-icon"
          aria-label="Brand asset file"
          required
        />
        <button
          className="min-h-11 rounded-md border px-4 text-sm disabled:opacity-50"
          type="submit"
          disabled={pending}
        >
          {pending ? "Uploading…" : "Upload brand asset"}
        </button>
      </form>
      {state.error ? (
        <p className="mt-3 text-sm text-[var(--color-danger-500)]" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.publicUrl ? (
        <div
          className="mt-4 rounded-md bg-[var(--color-stone-100)] p-4"
          role="status"
        >
          <p className="text-xs text-[var(--color-stone-500)]">
            Uploaded and wired into the form. Save the configuration to keep it
            on the next generate.
          </p>
          <input
            className="mt-2 w-full bg-transparent font-mono text-xs"
            value={state.publicUrl}
            readOnly
            aria-label="Uploaded brand asset URL"
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      ) : null}
    </section>
  );
}
