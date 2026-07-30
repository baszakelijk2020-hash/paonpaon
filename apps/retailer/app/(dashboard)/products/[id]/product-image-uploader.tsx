"use client";

import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import Image from "next/image";
import { useActionState } from "react";

import {
  removeProductImage,
  uploadProductImage,
  type ProductImageActionState,
} from "./actions";

const initial: ProductImageActionState = {};

export function ProductImageUploader({
  productId,
  imageUrl,
}: {
  productId: string;
  imageUrl?: string;
}) {
  const [uploadState, uploadAction, uploading] = useActionState(
    uploadProductImage.bind(null, productId),
    initial,
  );
  const [removeState, removeAction, removing] = useActionState(
    removeProductImage.bind(null, productId),
    initial,
  );

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
        Product image
      </h2>
      <p className="text-sm text-[var(--color-stone-500)]">
        Tie-Mate phone-scale try-on prefers a sharp, evenly lit fabric close-up
        on the product swatch field (<code>swatch_image_url</code>), usually set
        via catalogue import. This primary image is only a fallback when no
        swatch exists.
      </p>
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          width={160}
          height={160}
          unoptimized
          className="aspect-square w-40 rounded-[var(--radius-md)] object-cover"
        />
      ) : (
        <p className="text-sm text-[var(--color-stone-500)]">
          No image uploaded yet.
        </p>
      )}
      <form
        action={uploadAction}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <input
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp"
          required
          aria-label="Product image file"
        />
        <Button type="submit" size="sm" disabled={uploading}>
          {uploading ? "Uploading…" : "Upload"}
        </Button>
      </form>
      {uploadState.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {uploadState.formError}
        </p>
      ) : null}
      {imageUrl ? (
        <form action={removeAction}>
          <Button type="submit" size="sm" variant="ghost" disabled={removing}>
            {removing ? "Removing…" : "Remove image"}
          </Button>
        </form>
      ) : null}
      {removeState.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {removeState.formError}
        </p>
      ) : null}
    </Card>
  );
}
