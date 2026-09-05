import { RetailerRepository, RetailerBranchRepository } from "@paon/database";
import { Badge } from "@paon/ui/components/Badge";
import Image from "next/image";
import { notFound } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function LocationsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();

  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer || retailer.status !== "active") {
    notFound();
  }

  const branches = await new RetailerBranchRepository(
    supabase,
  ).findPublishedByRetailer(retailer.id);

  // Separate branches by presentation mode
  const globeBranches = branches
    .filter(
      (b) =>
        b.presentationMode === "globe" &&
        b.latitude !== null &&
        b.longitude !== null,
    )
    .map((b) => ({
      id: b.id,
      name: b.name,
      latitude: b.latitude as number,
      longitude: b.longitude as number,
    }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-10">
        <p className="font-accent mb-1 text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
          {retailer.displayName}
        </p>
        <h1 className="font-display mb-3 text-4xl text-[var(--color-stone-900)]">
          Our locations
        </h1>
        <p className="max-w-xl text-lg text-[var(--color-stone-600)]">
          Visit us at one of our stores. Find hours, services, and contact
          information.
        </p>
      </div>

      {/* Globe visualization (if any branches use globe mode) */}
      {globeBranches.length > 0 && (
        <WorldMapVisualization
          branches={
            globeBranches as Array<{
              id: string;
              name: string;
              latitude: number;
              longitude: number;
            }>
          }
        />
      )}

      {/* Locations list */}
      {branches.length === 0 ? (
        <p className="text-center text-sm text-[var(--color-stone-500)]">
          No locations currently available.
        </p>
      ) : (
        <div className="space-y-8">
          {/* Render each branch */}
          {branches.map((branch) => (
            <div
              key={branch.id}
              className="overflow-hidden rounded-lg border border-[var(--color-stone-200)] bg-white"
            >
              {/* Map embedding for branches with map presentation mode */}
              {branch.presentationMode === "map" &&
                branch.latitude &&
                branch.longitude && (
                  <div className="h-80 w-full">
                    <iframe
                      width="100%"
                      height="100%"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${branch.longitude - 0.01},${branch.latitude - 0.01},${branch.longitude + 0.01},${branch.latitude + 0.01}&marker=${branch.latitude},${branch.longitude}`}
                      title={`Map of ${branch.name}`}
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                    />
                  </div>
                )}

              {/* Branch details */}
              <div className="p-6 sm:p-8">
                <h2 className="font-display mb-2 text-2xl text-[var(--color-stone-900)]">
                  <a href={`#branch-${branch.id}`} id={`branch-${branch.id}`}>
                    {branch.name}
                  </a>
                </h2>

                {branch.storeType && (
                  <p className="text-sm text-[var(--color-stone-600)]">
                    {branch.storeType}
                  </p>
                )}

                {/* Address */}
                {(branch.addressLine1 ||
                  branch.addressLine2 ||
                  branch.city ||
                  branch.region ||
                  branch.postalCode ||
                  branch.country) && (
                  <address className="not-italic">
                    <p className="mt-3 text-sm text-[var(--color-stone-700)]">
                      {[
                        branch.addressLine1,
                        branch.addressLine2,
                        branch.city,
                        branch.region,
                        branch.postalCode,
                        branch.country,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </address>
                )}

                {/* Contact Information */}
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  {branch.phone && (
                    <a
                      href={`tel:${branch.phone}`}
                      className="text-[var(--color-blue-600)] underline"
                    >
                      {branch.phone}
                    </a>
                  )}
                  {branch.contactEmail && (
                    <a
                      href={`mailto:${branch.contactEmail}`}
                      className="text-[var(--color-blue-600)] underline"
                    >
                      {branch.contactEmail}
                    </a>
                  )}
                  {branch.latitude && branch.longitude && (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${branch.latitude}&mlon=${branch.longitude}#map=16/${branch.latitude}/${branch.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--color-blue-600)] underline"
                    >
                      Get directions
                    </a>
                  )}
                </div>

                {/* Contact Actions */}
                {branch.contactActions && branch.contactActions.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {branch.contactActions.map((action, idx) => {
                      let href = "";
                      if (action.type === "call") {
                        href = `tel:${action.value}`;
                      } else if (action.type === "email") {
                        href = `mailto:${action.value}`;
                      } else if (
                        action.type === "directions" &&
                        branch.latitude &&
                        branch.longitude
                      ) {
                        href = `https://www.openstreetmap.org/?mlat=${branch.latitude}&mlon=${branch.longitude}#map=16/${branch.latitude}/${branch.longitude}`;
                      }

                      if (action.type === "book") {
                        // Check if it looks like a URL
                        if (
                          action.value.startsWith("http://") ||
                          action.value.startsWith("https://") ||
                          action.value.startsWith("/")
                        ) {
                          return (
                            <a
                              key={idx}
                              href={action.value}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block rounded bg-[var(--color-blue-600)] px-3 py-2 text-sm text-white underline"
                            >
                              {action.label}
                            </a>
                          );
                        }
                        return (
                          <span
                            key={idx}
                            className="inline-block rounded bg-[var(--color-stone-100)] px-3 py-2 text-sm text-[var(--color-stone-700)]"
                          >
                            {action.label}
                          </span>
                        );
                      }

                      return (
                        <a
                          key={idx}
                          href={href}
                          className="inline-block rounded bg-[var(--color-blue-600)] px-3 py-2 text-sm text-white"
                        >
                          {action.label}
                        </a>
                      );
                    })}
                  </div>
                )}

                {/* Opening Hours */}
                {branch.openingHours && branch.openingHours.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-medium text-[var(--color-stone-900)]">
                      Hours
                    </h3>
                    <ul className="mt-2 space-y-1 text-sm text-[var(--color-stone-600)]">
                      {branch.openingHours.map((hours) => (
                        <li key={hours.day} className="capitalize">
                          {hours.day}:{" "}
                          {hours.closed
                            ? "Closed"
                            : `${hours.opens || "—"} – ${hours.closes || "—"}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Services */}
                {branch.services && branch.services.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-medium text-[var(--color-stone-900)]">
                      Services
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {branch.services.map((service) => (
                        <Badge key={service} tone="neutral">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Filter Categories */}
                {branch.filterCategories &&
                  branch.filterCategories.length > 0 && (
                    <div className="mt-6">
                      <h3 className="font-medium text-[var(--color-stone-900)]">
                        Categories
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {branch.filterCategories.map((category) => (
                          <Badge key={category}>{category}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Images */}
                {branch.imagery && branch.imagery.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-medium text-[var(--color-stone-900)]">
                      Photos
                    </h3>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {branch.imagery.map((image, idx) => (
                        <div
                          key={idx}
                          className="overflow-hidden rounded border border-[var(--color-stone-200)]"
                        >
                          <div className="relative h-40 w-full">
                            <Image
                              src={image.url}
                              alt={image.alt}
                              fill
                              className="object-cover"
                            />
                          </div>
                          {image.rightsNote && (
                            <p className="bg-[var(--color-stone-50)] px-2 py-1 text-xs text-[var(--color-stone-500)]">
                              {image.rightsNote}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

/**
 * Full 3D globe (Cesium) deferred — needs the bundle/tile-cost budget decision
 * the founder spec requires before activation; this SVG plot satisfies the
 * spec's own list-only/no-WebGL fallback requirement.
 */
function WorldMapVisualization({
  branches,
}: {
  branches: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  }>;
}) {
  const width = 800;
  const height = 400;

  return (
    <div className="mb-10 overflow-x-auto rounded border border-[var(--color-stone-200)] bg-[var(--color-stone-50)]">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="min-w-full"
        aria-label="World map showing branch locations"
      >
        {/* Simple world outline (equirectangular projection) */}
        <rect width={width} height={height} fill="white" />
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#e5e7eb"
          strokeWidth="1"
        />

        {/* Longitude lines */}
        {[0, 90, 180, 270].map((lon) => (
          <line
            key={`vline-${lon}`}
            x1={(lon / 360) * width}
            y1="0"
            x2={(lon / 360) * width}
            y2={height}
            stroke="#f3f4f6"
            strokeWidth="1"
          />
        ))}

        {/* Plot branches */}
        {branches.map((branch) => {
          const x = ((branch.longitude + 180) / 360) * width;
          const y = ((90 - branch.latitude) / 180) * height;

          return (
            <a
              key={branch.id}
              href={`#branch-${branch.id}`}
              title={branch.name}
            >
              <circle
                cx={x}
                cy={y}
                r="6"
                fill="#dc2626"
                opacity="0.7"
                className="hover:opacity-100"
              />
              <circle
                cx={x}
                cy={y}
                r="6"
                fill="none"
                stroke="#dc2626"
                strokeWidth="2"
                opacity="0.3"
              />
            </a>
          );
        })}
      </svg>
    </div>
  );
}
