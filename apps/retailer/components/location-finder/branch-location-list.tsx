type BranchLocation = {
  id: string;
  name: string;
  timezone: string;
  isDefault: boolean;
};

export function BranchLocationList({
  branches,
}: {
  branches: BranchLocation[];
}) {
  if (branches.length === 0) {
    return (
      <section className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] bg-white p-8 text-center">
        <h2 className="font-display text-xl">No locations configured</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--color-stone-500)]">
          Your house has no configured locations yet. Location contact details,
          services and public map placement will appear here once they are
          configured for this retailer.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Retailer locations"
      className="grid gap-4 lg:grid-cols-2"
    >
      {branches.map((branch) => (
        <article
          key={branch.id}
          className="rounded-[var(--radius-md)] border bg-white p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl">{branch.name}</h2>
              <p className="mt-2 text-sm text-[var(--color-stone-500)]">
                House timezone: {branch.timezone}
              </p>
            </div>
            {branch.isDefault ? (
              <span className="rounded-full bg-[var(--color-stone-900)] px-3 py-1 text-xs font-medium text-white">
                Default house
              </span>
            ) : null}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
            <div>
              <dt className="text-[var(--color-stone-500)]">Location status</dt>
              <dd className="mt-1 font-medium">Configured internally</dd>
            </div>
            <div>
              <dt className="text-[var(--color-stone-500)]">
                Public location details
              </dt>
              <dd className="mt-1 font-medium">Not yet configured</dd>
            </div>
          </dl>
        </article>
      ))}
    </section>
  );
}
