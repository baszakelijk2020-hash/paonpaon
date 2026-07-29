"use client";

import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { useState } from "react";

interface PersonaLogin {
  app: "admin" | "retailer" | "customer";
  retailer?: string;
  persona: string;
  email: string;
  href: string;
}

export function DemoPersonaDirectory({
  personas,
  password,
}: {
  personas: PersonaLogin[];
  password: string;
}) {
  const [copied, setCopied] = useState<string>();

  async function copyLogin(persona: PersonaLogin) {
    await navigator.clipboard.writeText(
      `${persona.email}\n${password}\n${persona.href}`,
    );
    setCopied(persona.email);
    window.setTimeout(() => setCopied(undefined), 1800);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {personas.map((persona) => (
        <article
          key={persona.email}
          className="group flex min-h-44 flex-col justify-between rounded-[var(--radius-xl)] border border-[var(--color-stone-200)] bg-white p-5 transition duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-lifted)]"
        >
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-lg text-[var(--color-stone-900)]">
                  {persona.persona}
                </p>
                <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                  {persona.retailer ?? "PAON platform"}
                </p>
              </div>
              <Badge tone={persona.app === "customer" ? "neutral" : "success"}>
                {persona.app}
              </Badge>
            </div>
            <p className="mt-5 break-all font-mono text-[11px] text-[var(--color-stone-600)]">
              {persona.email}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <a
              href={persona.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center rounded-[var(--radius-md)] bg-[var(--color-ink-600)] px-4 text-xs font-medium text-white"
            >
              Open environment
            </a>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => copyLogin(persona)}
            >
              {copied === persona.email ? "Copied" : "Copy login"}
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
