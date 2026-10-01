"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { createPortal } from "react-dom";

import {
  addAppointmentProductToBag,
  toggleAppointmentProductFavorite,
  type AppointmentProductFormState,
} from "./appointment-product-actions";

const NO_FORM_ERROR: AppointmentProductFormState = {};

export interface AppointmentProductData {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly imageUrl: string;
  readonly variantId: string;
  readonly price: string;
}

export function AppointmentProductPreview({
  product,
  retailerId,
  storeSlug,
  imageHeight = 88,
  boxHeight = imageHeight,
}: {
  product: AppointmentProductData;
  retailerId: string;
  storeSlug: string;
  /** How tall the garment is drawn; its width follows from that. */
  imageHeight?: number;
  /** How much of it is shown. Lower than `imageHeight` crops from the bottom. */
  boxHeight?: number;
}) {
  const [open, setOpen] = useState(false);
  // A retailer switching a module off, or a repository failure, comes back as
  // a message rendered under the buttons. Before this the action threw and took
  // the whole Appointments page down with it.
  const [favoriteState, favoriteAction] = useActionState(
    toggleAppointmentProductFavorite,
    NO_FORM_ERROR,
  );
  const [bagState, bagAction] = useActionState(
    addAppointmentProductToBag,
    NO_FORM_ERROR,
  );
  const formError = bagState.formError ?? favoriteState.formError;

  return (
    <>
      <button
        type="button"
        className="appointment-timeline-product"
        aria-label={`View ${product.name}`}
        onClick={() => setOpen(true)}
        // The row height is fixed at 88px and the width follows the image's own
        // aspect ratio. A square box either cropped the garment out of frame or,
        // with `contain`, left empty bars beside it — neither is acceptable, so
        // the box takes whatever width the image is at 88px tall.
        style={{
          position: "relative",
          display: "block",
          flex: "0 0 auto",
          width: "auto",
          height: boxHeight,
          overflow: "hidden",
          borderRadius: 6,
        }}
      >
        {/* The catalogue URL is already the retailer's optimized storefront asset. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl}
          alt=""
          style={{
            display: "block",
            width: "auto",
            height: imageHeight,
            objectFit: "cover",
          }}
        />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="appointment-product-backdrop"
              role="presentation"
              style={{
                position: "fixed",
                zIndex: 9999,
                inset: 0,
                display: "grid",
                placeItems: "center",
                padding: 24,
                background: "rgba(0, 0, 0, 0.68)",
                backdropFilter: "blur(12px)",
              }}
              onMouseDown={(event) => {
                if (event.currentTarget === event.target) setOpen(false);
              }}
            >
              <article
                className="appointment-product-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`appointment-product-${product.id}`}
                style={{
                  position: "relative",
                  width: "min(390px, 100%)",
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,.1)",
                  borderRadius: 24,
                  background: "#1c1c1c",
                  color: "#f4f2ec",
                  boxShadow: "0 28px 80px rgba(0,0,0,.5)",
                }}
              >
                <button
                  type="button"
                  className="appointment-product-close"
                  aria-label="Close product"
                  onClick={() => setOpen(false)}
                  style={{
                    position: "absolute",
                    zIndex: 2,
                    top: 12,
                    right: 12,
                    width: 34,
                    height: 34,
                    border: 0,
                    borderRadius: 999,
                    background: "rgba(0,0,0,.58)",
                    color: "#fff",
                    fontSize: 20,
                  }}
                >
                  ×
                </button>
                <div
                  className="appointment-product-image"
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "1",
                    background: "#252525",
                  }}
                >
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    unoptimized
                    sizes="360px"
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <div
                  className="appointment-product-copy"
                  style={{ padding: "18px 18px 16px" }}
                >
                  <h3 id={`appointment-product-${product.id}`}>
                    {product.name}
                  </h3>
                  <strong>{product.price}</strong>
                  <p>{product.description}</p>
                </div>
                <div
                  className="appointment-product-actions"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "45px 1fr 1fr",
                    gap: 8,
                    padding: "0 18px 18px",
                  }}
                >
                  <form action={favoriteAction}>
                    <input type="hidden" name="retailerId" value={retailerId} />
                    <input
                      type="hidden"
                      name="productVariantId"
                      value={product.variantId}
                    />
                    <button
                      type="submit"
                      aria-label={`Favourite ${product.name}`}
                      style={{
                        minHeight: 45,
                        border: 0,
                        borderRadius: 999,
                        background: "#2a2a2a",
                        color: "#f4f2ec",
                      }}
                    >
                      ♡
                    </button>
                  </form>
                  <Link
                    href={`/r/${storeSlug}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 45,
                      borderRadius: 999,
                      background: "#2a2a2a",
                      color: "#f4f2ec",
                      fontSize: 11,
                      textDecoration: "none",
                    }}
                  >
                    Continue In-Store
                  </Link>
                  <form action={bagAction}>
                    <input type="hidden" name="retailerId" value={retailerId} />
                    <input
                      type="hidden"
                      name="productVariantId"
                      value={product.variantId}
                    />
                    <button
                      type="submit"
                      style={{
                        minHeight: 45,
                        width: "100%",
                        border: 0,
                        borderRadius: 999,
                        background: "#b8e6be",
                        color: "#14120f",
                      }}
                    >
                      Add to Bag
                    </button>
                  </form>
                  {formError ? (
                    <p
                      role="alert"
                      style={{
                        gridColumn: "1 / -1",
                        margin: 0,
                        color: "#f4b4b4",
                        fontSize: 11,
                        lineHeight: 1.4,
                      }}
                    >
                      {formError}
                    </p>
                  ) : null}
                </div>
              </article>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
