-- PHASE 10.1: activates a versioned campaign into shared staff missions by
-- reusing clienteling_opportunities (PHASE 7.4) rather than inventing a
-- second staff-task table. A "campaign_mission" opportunity is the same
-- draft-task/contact-pressure/outcome-linking object every other opportunity
-- type already is; only campaign_id and one new opportunity_type value are
-- new here.

alter table public.clienteling_opportunities
  add column if not exists campaign_id uuid
    references public.campaigns (id) on delete set null;

alter table public.clienteling_opportunities
  drop constraint if exists clienteling_opportunities_opportunity_type_check;

alter table public.clienteling_opportunities
  add constraint clienteling_opportunities_opportunity_type_check check (
    opportunity_type in (
      'interest_follow_up',
      'purchase_care_check',
      'occasion_readiness',
      'relationship_dormancy',
      'wardrobe_gap',
      'anniversary_moment',
      'contact_pressure_warning',
      'campaign_mission'
    )
  );

-- Idempotent activation: re-running activateToStaffMissions for the same
-- campaign must not create duplicate missions for a customer who was
-- already eligible on a prior activation pass.
create unique index if not exists clienteling_opportunities_campaign_customer_uidx
  on public.clienteling_opportunities (campaign_id, customer_id)
  where campaign_id is not null and deleted_at is null;

create index if not exists clienteling_opportunities_campaign_idx
  on public.clienteling_opportunities (campaign_id)
  where campaign_id is not null;
