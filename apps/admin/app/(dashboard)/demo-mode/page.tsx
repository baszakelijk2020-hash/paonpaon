import { createSupabaseAdminClient } from "@paon/database";
import {
  DEMO_CANONICAL_PERSONAS,
  DEMO_PASSWORD,
} from "@paon/database/demo-seed";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";

import { DemoLoginsForm } from "./demo-logins-form";
import { DemoPersonaDirectory } from "./demo-persona-directory";
import { SeedDemoDataForm } from "./seed-demo-data-form";

import { env } from "@/lib/env";
import { requireSession } from "@/lib/session";

export default async function DemoModePage() {
  const session = await requireSession();

  const admin = createSupabaseAdminClient(
    env.supabaseUrl,
    env.supabaseServiceRoleKey,
  );
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const demoUsers = (data?.users ?? []).filter((u) =>
    u.email?.endsWith("@nebelspiegel.com"),
  );
  const activeCount = demoUsers.filter(
    (u) => !u.banned_until || new Date(u.banned_until) < new Date(),
  ).length;
  const isOwner = session.platformRole === "platform_owner";
  const customerAppUrl = env.customerAppUrl ?? "http://localhost:3002";
  const personas = DEMO_CANONICAL_PERSONAS.map((persona) => ({
    ...persona,
    href:
      persona.app === "admin"
        ? `${env.adminAppUrl}/login`
        : persona.app === "retailer"
          ? `${env.retailerAppUrl}/login`
          : `${customerAppUrl}/login?demo=1`,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 border-b border-[var(--color-stone-200)] pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="font-accent text-[8px] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
            Showcase environment
          </p>
          <h1 className="font-display mt-2 text-4xl text-[var(--color-stone-900)]">
            Seed data
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-stone-500)]">
            Open the one canonical persona for each active showcase role. Nebel
            &amp; Spiegel is the shared journey tenant; other seeded records
            support fixture coverage and are not demo launcher identities.
          </p>
          <a
            href={`${customerAppUrl}/r/atelier-demo`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex h-9 items-center rounded-[var(--radius-md)] bg-[var(--color-ink-600)] px-4 text-xs font-medium text-white"
          >
            Browse storefront (suits, jackets &amp; more)
          </a>
        </div>
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-stone-900)] px-5 py-4 text-white">
          <p className="font-accent text-[7px] uppercase tracking-[0.16em] text-white/45">
            Shared demo password
          </p>
          <p className="mt-2 font-mono text-sm">{DEMO_PASSWORD}</p>
        </div>
      </div>

      <Card className="grid gap-6 shadow-[var(--shadow-elevated)] lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="flex items-center gap-3">
            <p className="font-display text-lg text-[var(--color-stone-900)]">
              Environment health
            </p>
            <Badge tone={demoUsers.length > 0 ? "success" : "neutral"}>
              {demoUsers.length > 0 ? "ready" : "empty"}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-[var(--color-stone-500)]">
            {demoUsers.length} accounts provisioned · {activeCount} active
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          {isOwner ? (
            <SeedDemoDataForm />
          ) : (
            <p className="text-sm text-[var(--color-stone-500)]">
              Only a platform owner can populate or toggle demo data.
            </p>
          )}
          {isOwner && demoUsers.length > 0 ? <DemoLoginsForm /> : null}
        </div>
      </Card>

      <div>
        <h2 className="font-display text-2xl text-[var(--color-stone-900)]">
          Choose a perspective
        </h2>
        <p className="mt-1 text-sm text-[var(--color-stone-500)]">
          Copy a complete login or open its correct application in a new tab.
          Every shortcut authenticates through the application&apos;s normal
          production authorization path.
        </p>
      </div>

      <DemoPersonaDirectory personas={personas} password={DEMO_PASSWORD} />
    </div>
  );
}
