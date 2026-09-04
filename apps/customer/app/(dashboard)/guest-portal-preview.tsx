"use client";

import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";
import { useState } from "react";

import { MagicLinkForm } from "../login/magic-link-form";
import { QuickDemoLogin } from "../login/quick-demo-login";

/**
 * Guest landing after the storefront profile icon. Three actions only —
 * no faux nav that only says "sign in to open."
 *
 * "Sign in" used to navigate to the separate /login page — a founder-
 * designed distinct lander (ADR-046/047), fine as the storefront's own
 * front door, but a jarring click-away when someone is already inside
 * the dashboard shell. Clicking it now reveals the same MagicLinkForm/
 * QuickDemoLogin in place instead, so signing in never leaves this
 * screen.
 */
export function GuestPortalPreview({
  storeHref = "/r/atelier-demo",
}: {
  storeHref?: string;
}) {
  const [signingIn, setSigningIn] = useState(false);
  const slug = storeHref.replace(/^\/r\//, "") || "atelier-demo";
  const bookHref = `${storeHref}#book`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-1 pb-10 pt-2">
      <Card className="overflow-hidden border-0 bg-[#1a1a1a] p-0 text-white shadow-none">
        <div className="relative min-h-[16rem] px-6 py-7 sm:min-h-[18rem] sm:px-10 sm:py-12">
          <p className="font-accent text-[10px] uppercase tracking-[0.22em] text-white/45">
            Private client
          </p>
          <h1 className="font-display mt-4 max-w-xl text-3xl leading-[0.95] tracking-[-0.03em] sm:text-5xl">
            Your wardrobe, beautifully in motion.
          </h1>

          {signingIn ? (
            <div className="mt-6 max-w-sm rounded-[var(--radius-md)] border border-white/15 bg-white/10 p-6 backdrop-blur-2xl [&_button[type='submit']]:!rounded-[var(--radius-md)] [&_button[type='submit']]:!border [&_button[type='submit']]:!border-white/25 [&_button[type='submit']]:!bg-white/15 [&_button[type='submit']]:!text-white [&_button[type='submit']]:!backdrop-blur-xl hover:[&_button[type='submit']]:!bg-white/25 [&_input]:!rounded-[var(--radius-md)] [&_input]:!border-white/25 [&_input]:!bg-white/90 [&_input]:!px-5 [&_input]:!text-[var(--color-stone-900)] [&_input]:!backdrop-blur-xl [&_label]:!text-white/85">
              <MagicLinkForm redirectTo="/dashboard" />
              <QuickDemoLogin redirectTo="/dashboard" />
              <button
                type="button"
                onClick={() => setSigningIn(false)}
                className="mt-5 text-xs text-white/60 underline underline-offset-4 hover:text-white/85"
              >
                Back
              </button>
            </div>
          ) : (
            <>
              <p className="mt-5 max-w-md text-sm leading-7 text-white/60">
                Sign in for appointments, orders, messages and loyalty. Or keep
                browsing the collection and book a fitting when you are ready.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => setSigningIn(true)}
                  className={buttonVariants({
                    variant: "secondary",
                    size: "lg",
                  })}
                >
                  Sign in
                </button>
                <Link
                  href={bookHref}
                  className={buttonVariants({
                    variant: "outline",
                    size: "lg",
                    className: "border-white/35 text-white hover:bg-white/10",
                  })}
                >
                  Book a fitting
                </Link>
                <Link
                  href={storeHref}
                  className={buttonVariants({
                    variant: "ghost",
                    size: "lg",
                    className: "text-white hover:bg-white/10",
                  })}
                >
                  Continue shopping
                </Link>
              </div>
            </>
          )}
        </div>
      </Card>

      <p className="text-center text-sm text-black/45">
        Returning to {slug}?{" "}
        <Link href={storeHref} className="underline underline-offset-4">
          Open the storefront
        </Link>
      </p>
    </div>
  );
}
