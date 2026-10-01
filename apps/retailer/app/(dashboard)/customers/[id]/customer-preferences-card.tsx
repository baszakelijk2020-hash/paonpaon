import type { CustomerPreferences } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  push: "Push",
  in_app: "In-app",
};

function Consent({ granted, label }: { granted: boolean; label: string }) {
  return (
    <span
      className={
        granted
          ? "rounded-full bg-[var(--color-stone-900)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#f0efec]"
          : "rounded-full bg-[var(--color-stone-100)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-stone-500)]"
      }
    >
      {label} {granted ? "yes" : "no"}
    </span>
  );
}

/**
 * What the customer set for themselves in Account Settings.
 *
 * All of it — locale, currency, which channels they agreed to be contacted
 * on, their own free-text style notes, and the three consent flags — was
 * written by the customer app and read by nothing. Staff had no way to see
 * that someone had opted out of marketing before contacting them, which is a
 * consent question, not a convenience one. `customer_preferences` has carried
 * a retailer-staff read policy the whole time.
 */
export function CustomerPreferencesCard({
  preferences,
}: {
  preferences: CustomerPreferences | null;
}) {
  return (
    <Card className="p-6">
      <h2 className="font-display text-lg text-[var(--color-stone-900)]">
        Their preferences
      </h2>
      <p className="text-sm text-[var(--color-stone-500)]">
        Set by the customer in their own account. Read-only here — theirs to
        change, not yours.
      </p>

      {preferences === null ? (
        <p className="mt-4 text-sm text-[var(--color-stone-500)]">
          This customer has not set any preferences yet. Treat consent as not
          given.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Consent granted={preferences.marketingOptIn} label="Marketing" />
            <Consent
              granted={preferences.personalizationOptIn}
              label="Personalisation"
            />
            <Consent granted={preferences.locationOptIn} label="Location" />
          </div>

          <div>
            <p className="text-xs uppercase text-[var(--color-stone-500)]">
              Reachable on
            </p>
            <p className="text-[var(--color-stone-900)]">
              {preferences.communicationChannels.length === 0
                ? "No channel agreed"
                : preferences.communicationChannels
                    .map((channel) => CHANNEL_LABELS[channel] ?? channel)
                    .join(" · ")}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-[var(--color-stone-500)]">
              Language and currency
            </p>
            <p className="text-[var(--color-stone-900)]">
              {preferences.preferredLocale} · {preferences.preferredCurrency}
            </p>
          </div>

          {preferences.styleNotes ? (
            <div>
              <p className="text-xs uppercase text-[var(--color-stone-500)]">
                In their own words
              </p>
              <p className="text-[var(--color-stone-900)]">
                {preferences.styleNotes}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
