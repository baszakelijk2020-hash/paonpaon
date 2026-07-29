import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";

/**
 * Guest landing after the storefront profile icon. Three actions only —
 * no faux nav that only says “sign in to open.”
 */
export function GuestPortalPreview({
  storeHref = "/r/maison-dubois",
}: {
  storeHref?: string;
}) {
  const slug = storeHref.replace(/^\/r\//, "") || "maison-dubois";
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
          <p className="mt-5 max-w-md text-sm leading-7 text-white/60">
            Sign in for appointments, orders, messages and loyalty. Or keep
            browsing the collection and book a fitting when you are ready.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/login?redirectTo=%2Fdashboard"
              className={buttonVariants({ variant: "secondary", size: "lg" })}
            >
              Sign in
            </Link>
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
