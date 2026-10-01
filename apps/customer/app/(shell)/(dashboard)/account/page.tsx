import {
  CustomerPreferencesRepository,
  RetailerRepository,
} from "@paon/database";

import { SignOutButton } from "../components/sign-out-button";

import { AddressesForm } from "./addresses-form";
import { GuestAddressPreview } from "./guest-address-preview";
import { IdentityForm } from "./identity-form";
import { OneClickStatusCard } from "./one-click-status-card";
import { PreferencesForm } from "./preferences-form";

import { getCustomersForUser } from "@/lib/customer-context";
import { getViewerSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function AccountPage() {
  const session = await getViewerSession();
  const supabase = await getSupabaseServerClient();

  const customers = await getCustomersForUser(session.userId);
  const retailerRepo = new RetailerRepository(supabase);
  const preferencesRepo = new CustomerPreferencesRepository(supabase);

  const groups = await Promise.all(
    customers.map(async (customer) => {
      // Independent of each other — batched rather than chained.
      const [retailer, preferences] = await Promise.all([
        retailerRepo.findById(customer.retailerId),
        preferencesRepo.findByCustomer(customer.id),
      ]);
      return {
        customer,
        retailer,
        preferences,
      };
    }),
  );

  return (
    <div className="customer-page flex flex-col gap-6 bg-black pb-12 text-white">
      <header className="pe-page-head pb-3">
        <div className="max-w-2xl">
          <p className="customer-kicker mb-2 text-white/55">
            Profile and preferences
          </p>
          <h1 className="font-display text-5xl font-semibold leading-none tracking-[-0.055em] text-white sm:text-6xl">
            Profile
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/60">
            Choose how your retailer contacts you and personalises your
            experience.
          </p>
        </div>
      </header>

      {groups.length === 0 ? (
        <>
          <div
            className="pe-card flex min-h-40 items-center rounded-[32px] bg-[#191b1d] px-7 py-10"
            data-pe-card
          >
            <div>
              <p className="customer-kicker text-white/55">Your profile</p>
              <p className="mt-2 text-base text-white/65">
                Sign in to save your details across the house.
              </p>
            </div>
          </div>
          <GuestAddressPreview />
        </>
      ) : (
        groups.map(({ customer, retailer, preferences }) => (
          <div key={customer.id} className="flex flex-col gap-6">
            {/* Top row: Retailer card + 1-Click status */}
            <section className="grid items-start gap-4 lg:grid-cols-[minmax(220px,0.36fr)_minmax(0,1fr)]">
              <div
                className="pe-card pe-card-mint flex min-h-52 flex-col justify-between rounded-[32px] bg-[#b8e6be] p-7 text-[#181818]"
                data-pe-card
              >
                <div>
                  <p className="customer-kicker text-[#181818]/60">
                    Your retailer
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[#181818]">
                    {retailer?.displayName ?? "Retailer"}
                  </h2>
                </div>
                <span className="inline-flex min-h-[44px] w-fit items-center rounded-full bg-[#181818] px-4 text-sm font-semibold text-white">
                  Private client
                </span>
              </div>
              <div className="flex flex-col gap-4">
                <OneClickStatusCard
                  retailerId={customer.retailerId}
                  status={customer.oneClickCheckoutStatus}
                />
              </div>
            </section>

            {/* Identity card */}
            <IdentityForm
              retailerId={customer.retailerId}
              customer={customer}
            />

            {/* Addresses card */}
            <AddressesForm
              retailerId={customer.retailerId}
              customer={customer}
            />

            {/* Preferences card */}
            <div
              className="pe-card pe-card-lavender rounded-[32px] bg-[#c7c1ef] p-2 text-[#181818] [&>div]:rounded-[26px] [&>div]:border-0 [&>div]:bg-transparent [&>div]:shadow-none [&_fieldset]:rounded-[22px] [&_fieldset]:bg-black/[0.05] [&_fieldset]:p-5"
              data-pe-card
            >
              <PreferencesForm
                retailerId={customer.retailerId}
                retailerName={retailer?.displayName ?? "Retailer"}
                preferences={preferences}
              />
            </div>
          </div>
        ))
      )}

      {session.isGuest ? null : (
        <section
          className="pe-card flex items-center justify-between gap-4 rounded-[32px] bg-[#191b1d] px-6 py-5"
          data-pe-card
        >
          <div>
            <p className="customer-kicker text-white/55">Session</p>
            <p className="mt-1 text-base text-white/65">
              Sign out of your PAON account everywhere.
            </p>
          </div>
          <SignOutButton
            className="inline-flex min-h-[52px] shrink-0 items-center rounded-full bg-[#f0b6a4] px-5 text-[#181818]"
            testId="customer-signout"
          />
        </section>
      )}
    </div>
  );
}
