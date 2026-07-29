export default function OrdersLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-9 w-full max-w-md rounded-[var(--radius-md)] bg-[var(--color-stone-100)]" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-16 rounded-[var(--radius-md)] bg-[var(--color-stone-100)]"
          />
        ))}
      </div>
    </div>
  );
}
