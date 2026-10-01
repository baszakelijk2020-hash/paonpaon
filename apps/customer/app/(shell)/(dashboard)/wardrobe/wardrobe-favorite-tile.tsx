"use client";

import { useActionState } from "react";

import {
  toggleWishlistItem,
  type WishlistActionState,
} from "./wishlist-actions";

const initial: WishlistActionState = { fieldErrors: {} };

export interface WardrobeFavoriteView {
  readonly id: string;
  readonly name: string;
  readonly primaryImageUrl: string | undefined;
  readonly variantId: string;
}

/** One saved piece; removing it from favorites happens right here. */
export function WardrobeFavoriteTile({
  retailerId,
  favorite,
}: {
  retailerId: string;
  favorite: WardrobeFavoriteView;
}) {
  const [state, formAction, isPending] = useActionState(
    toggleWishlistItem,
    initial,
  );

  if (state.success) return null;

  return (
    <li>
      <article className="paon-wardrobe-fav" data-pe-card>
        <div className="paon-wardrobe-fav-media">
          {favorite.primaryImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={favorite.primaryImageUrl} alt="" />
          ) : (
            <div className="paon-wardrobe-fav-empty">No image</div>
          )}
        </div>
        <div className="paon-wardrobe-fav-body">
          <p className="paon-wardrobe-fav-name">{favorite.name}</p>
          <form action={formAction}>
            <input type="hidden" name="retailerId" value={retailerId} />
            <input
              type="hidden"
              name="productVariantId"
              value={favorite.variantId}
            />
            <button
              type="submit"
              className="paon-wardrobe-pill"
              disabled={isPending}
            >
              {isPending ? "Removing…" : "Remove"}
            </button>
          </form>
          {state.formError ? (
            <p role="alert" className="paon-wardrobe-error">
              {state.formError}
            </p>
          ) : null}
        </div>
      </article>
    </li>
  );
}
