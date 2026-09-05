"use client";

export function HouseSwitcher({
  houses,
}: {
  houses: Array<{ id: string; name: string }>;
}) {
  if (houses.length < 2) return null;

  return (
    <div className="bg-[var(--color-stone-50)]/95 sticky top-16 z-10 -mx-1 flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 backdrop-blur sm:top-4">
      <label
        htmlFor="house-switcher"
        className="shrink-0 text-xs uppercase tracking-[0.14em] text-[var(--color-stone-500)]"
      >
        House
      </label>
      <select
        id="house-switcher"
        className="h-9 min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-2 text-sm"
        defaultValue=""
        onChange={(event) => {
          const id = event.target.value;
          if (!id) return;
          document
            .getElementById(`house-${id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      >
        <option value="" disabled>
          Jump to a house…
        </option>
        {houses.map((house) => (
          <option key={house.id} value={house.id}>
            {house.name}
          </option>
        ))}
      </select>
    </div>
  );
}
