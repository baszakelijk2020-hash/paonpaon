"use client";

import { useActionState } from "react";

import { uploadBrandAsset, type BrandAssetActionState } from "./actions";

const initialState: BrandAssetActionState = {};

export function BrandAssetUploader({ prospectId }: { prospectId: string }) {
  const action = uploadBrandAsset.bind(null, prospectId);
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <section className="rounded-[1.25rem] border bg-white p-6 sm:p-8">
      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
        Brand asset library
      </p>
      <p className="mt-3 text-sm text-stone-500">
        Upload public-facing logo, favicon or editorial imagery, then use its
        generated URL in the configuration below.
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
            Uploaded. Copy into the appropriate logo, favicon or hero field.
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
