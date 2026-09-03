import { CorporateRepository, type CorporateManager } from "@paon/database";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import Link from "next/link";

import { createAccount, createProgramme, setAccountManager } from "./actions";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function CorporatePage() {
  const session = await requireModuleSession("enterprise_verticals", "read");
  const repo = new CorporateRepository(await getSupabaseServerClient());
  const [accounts, programmes] = await Promise.all([
    repo.findAccountsByRetailer(session.retailerId),
    repo.findProgrammesByRetailer(session.retailerId),
  ]);
  const wearerCounts = await Promise.all(
    programmes.map((programme) => repo.findWearersByProgramme(programme.id)),
  );
  const managersByAccountId = new Map<string, CorporateManager[]>();
  for (const account of accounts) {
    const managers = await repo.findManagersByAccount(account.id);
    managersByAccountId.set(account.id, managers);
  }
  const accountsById = new Map(
    accounts.map((account) => [account.id, account]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Corporate
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Métier corporate wardrobe accounts — entitlements, wearers and issue
          records. Never the employment record: no salary, no manager hierarchy,
          no diagnosis.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
            Accounts
          </h2>
          {accounts.length === 0 ? (
            <p className="text-sm text-[var(--color-stone-500)]">
              No corporate accounts yet.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
              {accounts.map((account) => {
                const managers = managersByAccountId.get(account.id) ?? [];
                return (
                  <li
                    key={account.id}
                    className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-stone-900)]">
                          {account.legalName}
                        </p>
                        <p className="text-xs text-[var(--color-stone-500)]">
                          {account.accountReference}
                        </p>
                      </div>
                      <Badge tone={account.active ? "success" : "neutral"}>
                        {account.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    {managers.length > 0 ? (
                      <div>
                        <p className="mb-1 text-xs font-medium text-[var(--color-stone-700)]">
                          Managers
                        </p>
                        <ul
                          className="flex flex-col gap-1"
                          id={`managers-${account.id}`}
                        >
                          {managers.map((manager) => (
                            <li
                              key={manager.id}
                              className="text-xs text-[var(--color-stone-700)]"
                            >
                              <p className="font-medium">
                                {manager.contactName}
                              </p>
                              <p className="text-[var(--color-stone-500)]">
                                {manager.loginEmail}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <details className="text-xs">
                      <summary className="cursor-pointer text-[var(--color-stone-700)]">
                        Add a manager
                      </summary>
                      <form
                        action={setAccountManager.bind(null, account.id)}
                        className="mt-2 grid gap-2"
                      >
                        <FormField
                          label="Contact name"
                          htmlFor={`name-${account.id}`}
                        >
                          <Input
                            id={`name-${account.id}`}
                            name="contactName"
                            required
                          />
                        </FormField>
                        <FormField
                          label="Login email"
                          htmlFor={`email-${account.id}`}
                        >
                          <Input
                            id={`email-${account.id}`}
                            name="loginEmail"
                            type="email"
                            required
                          />
                        </FormField>
                        <Button type="submit" size="sm" className="self-start">
                          Add manager
                        </Button>
                      </form>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
          <form action={createAccount} className="flex flex-col gap-3 pt-2">
            <FormField label="Legal name" htmlFor="legalName">
              <Input id="legalName" name="legalName" required minLength={2} />
            </FormField>
            <FormField label="Account reference" htmlFor="accountReference">
              <Input id="accountReference" name="accountReference" required />
            </FormField>
            <Button type="submit" className="self-start">
              Add account
            </Button>
          </form>
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
            Programmes
          </h2>
          {programmes.length === 0 ? (
            <p className="text-sm text-[var(--color-stone-500)]">
              No programmes yet.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
              {programmes.map((programme, index) => (
                <li key={programme.id} className="py-2">
                  <Link
                    href={`/corporate/${programme.id}`}
                    className="flex items-center justify-between gap-3 hover:underline"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--color-stone-900)]">
                        {programme.name}
                      </p>
                      <p className="text-xs text-[var(--color-stone-500)]">
                        {accountsById.get(programme.accountId)?.legalName ??
                          "Unknown account"}{" "}
                        · {wearerCounts[index]?.length ?? 0} wearer
                        {wearerCounts[index]?.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Badge tone={programme.active ? "success" : "neutral"}>
                      {programme.active ? "Active" : "Inactive"}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {accounts.length === 0 ? (
            <p className="text-xs text-[var(--color-stone-500)]">
              Add an account first.
            </p>
          ) : (
            <form action={createProgramme} className="flex flex-col gap-3 pt-2">
              <FormField label="Account" htmlFor="accountId">
                <Select id="accountId" name="accountId" required>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.legalName}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Programme name" htmlFor="name">
                <Input id="name" name="name" required minLength={2} />
              </FormField>
              <FormField
                label="Site keys (comma-separated, optional)"
                htmlFor="siteKeys"
              >
                <Input id="siteKeys" name="siteKeys" />
              </FormField>
              <Button type="submit" className="self-start">
                Add programme
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
