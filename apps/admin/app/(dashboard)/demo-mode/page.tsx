import { createSupabaseAdminClient } from "@paon/database";
import { Badge } from "@paon/ui/components/Badge";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";

import { setDemoLoginsActive } from "./actions";
import { SeedDemoDataForm } from "./seed-demo-data-form";

import { env } from "@/lib/env";
import { requireSession } from "@/lib/session";

export default async function DemoModePage() {
  const session = await requireSession();

  const admin = createSupabaseAdminClient(
    env.supabaseUrl,
    env.supabaseServiceRoleKey,
  );
  const { data } = await admin.auth.admin.listUsers();
  const demoUsers = (data?.users ?? []).filter((u) =>
    u.email?.endsWith("@nebelspiegel.com"),
  );
  const activeCount = demoUsers.filter(
    (u) => !u.banned_until || new Date(u.banned_until) < new Date(),
  ).length;
  const isOwner = session.platformRole === "platform_owner";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-[var(--font-display)] text-[var(--color-stone-900)]">
          Demo mode
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Populate the live deployment with two demo retailers — staff,
          customers, products with real photography, orders, appointments,
          alterations, loyalty and a referral — so you can browse the system as
          if it were live. Safe to run more than once.
        </p>
      </div>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-[var(--color-stone-900)]">
              Demo accounts
            </p>
            <p className="text-sm text-[var(--color-stone-500)]">
              {demoUsers.length} total, {activeCount} currently able to sign in
            </p>
          </div>
          <Badge tone={demoUsers.length > 0 ? "success" : "neutral"}>
            {demoUsers.length > 0 ? "populated" : "empty"}
          </Badge>
        </div>

        {isOwner ? (
          <SeedDemoDataForm />
        ) : (
          <p className="text-sm text-[var(--color-stone-500)]">
            Only a platform owner can populate or toggle demo data.
          </p>
        )}

        {isOwner && demoUsers.length > 0 ? (
          <div className="flex gap-2 border-t border-[var(--color-stone-100)] pt-4">
            <form action={setDemoLoginsActive.bind(null, true)}>
              <button
                type="submit"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Activate demo logins
              </button>
            </form>
            <form action={setDemoLoginsActive.bind(null, false)}>
              <button
                type="submit"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Deactivate demo logins
              </button>
            </form>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
