"use client";

import { useActionState, useEffect } from "react";

import { uploadBrandAsset, type BrandAssetActionState } from "./actions";

const initialState: BrandAssetActionState = {};

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

export function BrandAssetUploader({ prospectId }: { prospectId: string }) {
  const action = uploadBrandAsset.bind(null, prospectId);
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (!state.publicUrl) return;
    appendGarmentPhotoUrl(state.publicUrl);
  }, [state.publicUrl]);

  return (
    <section className="rounded-[1.25rem] border bg-white p-6 sm:p-8">
      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
        Brand asset library
      </p>
      <p className="mt-3 text-sm text-stone-500">
        Upload logo, favicon, hero, or garment photography. Garment uploads are
        appended to the prospect garment photos list below automatically — copy
        the URL into logo / favicon / hero when that is the intent.
      </p>
      <form
        action={formAction}
        className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center"
      >
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
        <p className="mt-3 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.publicUrl ? (
        <div className="mt-4 rounded-md bg-stone-100 p-4" role="status">
          <p className="text-xs text-stone-500">
            Uploaded and added to garment photos (if room). Copy into logo,
            favicon or hero when needed, then save the configuration.
          </p>
          <input
            className="mt-2 w-full bg-transparent font-mono text-xs"
            value={state.publicUrl}
            readOnly
            aria-label="Uploaded brand asset URL"
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            type="button"
            className="mt-3 min-h-9 rounded-md border bg-white px-3 text-xs"
            onClick={() => {
              if (state.publicUrl) appendGarmentPhotoUrl(state.publicUrl);
            }}
          >
            Add to garment photos again
          </button>
        </div>
      ) : null}
    </section>
  );
}
