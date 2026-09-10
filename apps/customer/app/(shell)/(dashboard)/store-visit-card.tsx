"use client";

/* eslint-disable @next/next/no-img-element -- remote artwork tinted with
   filter(); next/image adds nothing for these and cannot optimise them. */
import Link from "next/link";

type StoreVisitCardProps = {
  storeHref: string;
};

/** Guest-side invitation to start the existing in-store booking flow. */
export function StoreVisitCard({ storeHref }: StoreVisitCardProps) {
  const bookHref = `${storeHref}#book`;

  return (
    <Link
      href={bookHref}
      aria-label="Visit in-store"
      className="flex h-[48px] w-[210px] items-center justify-between rounded-full border border-[rgba(255,255,255,0.15)] px-5 no-underline transition-colors duration-[400ms] ease-out hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white"
      style={{
        color: "#e4e4e1",
        fontFamily: "OptimaKlein, serif",
        fontSize: "14px",
        letterSpacing: "0.01em",
      }}
    >
      Visit in-store
      <img
        src="https://www.nebelspiegel.com/images/store100.png"
        alt=""
        aria-hidden="true"
        width={12.8}
        height={12.8}
        style={{
          flexShrink: 0,
          opacity: 0.85,
          position: "relative",
          left: "1px",
          objectFit: "contain",
        }}
      />
    </Link>
  );
}
