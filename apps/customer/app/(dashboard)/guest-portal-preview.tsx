import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";

/**
 * Read-only look of the private-client portal for guests who arrive from
 * the storefront profile icon. Mutations stay behind sign-in.
 */
export function GuestPortalPreview({
  storeHref = "/r/maison-dubois",
}: {
  storeHref?: string;
}) {
  const slug = storeHref.replace(/^\/r\//, "") || "maison-dubois";
  const storeLabel = slug;
  const customerEmail =
    slug === "maison-dubois"
      ? "contact+isabelle@nebelspiegel.com"
      : `contact+${slug}-isabelle@nebelspiegel.com`;
  const weddingDemoHref = `/login?demo=1&email=${encodeURIComponent(customerEmail)}&redirectTo=${encodeURIComponent("/wedding-parties")}`;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-1 pb-10 pt-2">
      <Card className="overflow-hidden border-0 bg-[#1a1a1a] p-0 text-white shadow-none">
        <div className="relative min-h-[18rem] px-6 py-8 sm:px-10 sm:py-12">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">
            Private client
          </p>
          <h1 className="font-display mt-4 max-w-xl text-4xl leading-[0.95] tracking-[-0.03em] sm:text-5xl">
            Your wardrobe, beautifully in motion.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-white/60">
            This is the private-client environment — appointments, pieces,
            conversations and recognition in one place. Sign in when you are
            ready; until then you can look around.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login?redirectTo=%2Fdashboard"
              className={buttonVariants({ variant: "secondary", size: "lg" })}
            >
              Sign in
            </Link>
            <Link
              href={weddingDemoHref}
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "border-white/35 text-white hover:bg-white/10",
              })}
            >
              Try the wedding party demo
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Next appointment", "Fittings and consultations stay visible here."],
          ["In the workroom", "Garment progress without chasing messages."],
          ["Recognition", "Loyalty and private invitations, when signed in."],
        ].map(([title, body]) => (
          <Card
            key={title}
            className="border-black/10 bg-[#f4f1ec] p-5 shadow-none"
          >
            <p className="text-[10px] uppercase tracking-[0.18em] text-black/40">
              {title}
            </p>
            <p className="mt-3 text-sm leading-6 text-black/55">{body}</p>
          </Card>
        ))}
      </div>

      <p className="text-center text-sm text-black/45">
        Prefer the storefront?{" "}
        <Link href={storeHref} className="underline underline-offset-4">
          Continue browsing {storeLabel}
        </Link>
      </p>
    </div>
  );
}
