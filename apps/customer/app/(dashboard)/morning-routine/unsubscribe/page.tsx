import { unsubscribeMorningRoutineByToken } from "../delivery-actions";

export default async function MorningRoutineUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token?.trim();

  if (!token) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Unsubscribe
        </h1>
        <p className="mt-3 text-sm text-[var(--color-stone-600)]">
          Missing unsubscribe token.
        </p>
      </div>
    );
  }

  const result = await unsubscribeMorningRoutineByToken(token);

  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
        MorningRoutine delivery
      </h1>
      {result.success ? (
        <p className="mt-3 text-sm text-[var(--color-stone-600)]" role="status">
          You are unsubscribed from MorningRoutine delivery. Marketing
          preferences are unchanged.
        </p>
      ) : (
        <p className="mt-3 text-sm text-[var(--color-danger-500)]" role="alert">
          {result.error ?? "Could not unsubscribe."}
        </p>
      )}
    </div>
  );
}
