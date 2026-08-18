import { CorporateRepository } from "@paon/database";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";

import { startWizard } from "./actions";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function SetupWizardStartPage() {
  const session = await requireModuleSession("enterprise_verticals", "read");
  const repo = new CorporateRepository(await getSupabaseServerClient());
  const accounts = await repo.findAccountsByRetailer(session.retailerId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Set up a new corporate programme
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Set up a new corporate programme in a few guided steps.
        </p>
      </div>

      <Card className="flex flex-col gap-6">
        <form action={startWizard} className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
              Corporate account
            </h2>

            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="accountChoice"
                  value="existing"
                  defaultChecked={accounts.length > 0}
                  required
                />
                <span className="text-sm text-[var(--color-stone-700)]">
                  Use an existing account
                </span>
              </label>
              {accounts.length > 0 ? (
                <div className="ml-6">
                  <FormField label="Account" htmlFor="existingAccountId">
                    <Select id="existingAccountId" name="existingAccountId">
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.legalName} — {account.accountReference}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2">
                <input type="radio" name="accountChoice" value="new" required />
                <span className="text-sm text-[var(--color-stone-700)]">
                  Create a new account
                </span>
              </label>
              <div className="ml-6 flex flex-col gap-3">
                <FormField label="Legal name" htmlFor="newAccountLegalName">
                  <Input
                    id="newAccountLegalName"
                    name="newAccountLegalName"
                    minLength={2}
                  />
                </FormField>
                <FormField
                  label="Account reference"
                  htmlFor="newAccountReference"
                >
                  <Input id="newAccountReference" name="newAccountReference" />
                </FormField>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
              Programme details
            </h2>

            <FormField label="Programme name" htmlFor="programmeName">
              <Input
                id="programmeName"
                name="programmeName"
                required
                minLength={2}
              />
            </FormField>

            <FormField
              label="Departments or sites (optional, comma-separated)"
              htmlFor="siteKeys"
            >
              <Input id="siteKeys" name="siteKeys" />
            </FormField>
          </div>

          <Button type="submit" className="self-start">
            Continue to roles →
          </Button>
        </form>
      </Card>
    </div>
  );
}
