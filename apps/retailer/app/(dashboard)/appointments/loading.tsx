export default function AppointmentsLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-6">
      <div className="h-9 w-full max-w-md rounded-[var(--radius-md)] bg-[var(--color-stone-100)]" />
      {Array.from({ length: 2 }).map((_, groupIndex) => (
        <div key={groupIndex} className="flex flex-col gap-2">
          <div className="h-3 w-24 rounded bg-[var(--color-stone-100)]" />
          <div className="flex flex-col gap-2 overflow-hidden rounded-[var(--radius-md)]">
            {Array.from({ length: 3 }).map((_, rowIndex) => (
              <div
                key={rowIndex}
                className="h-16 bg-[var(--color-stone-100)]"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
