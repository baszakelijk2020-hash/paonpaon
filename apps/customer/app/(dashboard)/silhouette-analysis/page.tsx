import {
  CustomerRepository,
  RetailerRepository,
  SilhouetteAnalysisRepository,
} from "@paon/database";
import { Card } from "@paon/ui/components/Card";

import { SilhouetteAnalysisPanel } from "./silhouette-analysis-panel";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * FT-02 Silhouette analysis (docs/FOUNDER_TOOL_BLUEPRINTS.md) —
 * consent/capture session state machine. A customer explicitly starts
 * a session, uploads a photo, their advisor reviews it, and the
 * customer gives the final confirmation. Level 2/3 automated analysis
 * is not built and not claimed here — this is the consent/capture/
 * review plumbing only, per the blueprint's own scope line.
 */
export default async function SilhouetteAnalysisPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const retailerRepo = new RetailerRepository(supabase);
  const silhouetteRepo = new SilhouetteAnalysisRepository(supabase);

  const groups = await Promise.all(
    customers.map(async (customer) => {
      const retailer = await retailerRepo.findById(customer.retailerId);
      const latestSession = await silhouetteRepo.findLatestSessionForCustomer(
        customer.retailerId,
      );
      const captures = latestSession
        ? await silhouetteRepo.findCapturesForSessionWithUrls(latestSession.id)
        : [];
      return { customer, retailer, session: latestSession, captures };
    }),
  );

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-12">
      <div>
        <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
          Fit consultation
        </p>
        <h1 className="font-display mt-1 text-3xl text-[var(--color-stone-900)]">
          Silhouette analysis
        </h1>
        <p className="mt-1 text-sm text-[var(--color-stone-500)]">
          Share a photo with your advisor so they can prepare fitting guidance
          before you arrive. You choose when to start, and you can withdraw at
          any time before you confirm.
        </p>
      </div>

      {groups.map(
        ({ customer, retailer, session: silhouetteSession, captures }) => (
          <Card key={customer.id} className="flex flex-col gap-3">
            <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
              {retailer?.displayName ?? "Your House"}
            </h2>
            <SilhouetteAnalysisPanel
              retailerId={customer.retailerId}
              session={silhouetteSession}
              captures={captures}
            />
          </Card>
        ),
      )}

      {groups.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-stone-500)]">
            No House relationship yet.
          </p>
        </Card>
      ) : null}
    </main>
  );
}
