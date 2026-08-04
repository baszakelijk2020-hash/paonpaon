-- PHASE 18.6 named gap closure: department/location grouping. 18.6's own
-- status named this precisely: "corporate_wearers has a siteKey field but
-- rollout days/slots do not group or filter by it at all, so a large
-- multi-site programme's rollout plan is currently one flat list of days,
-- not grouped per site."
--
-- A day with no site_key is company-wide (accepts any wearer, matching
-- today's behaviour exactly — no existing programme's rollout plan
-- changes unless a manager opts in by setting one). A day WITH a
-- site_key only ever accepts a wearer from that same site — enforced in
-- `packages/domain/src/corporate/rollout-planning.ts`'s
-- `checkAssignWearerToDay`/`planNoShowReslot`, not merely by which
-- options the UI happens to offer.

alter table public.corporate_rollout_days
  add column if not exists site_key text
    check (site_key is null or char_length(site_key) <= 64);

create index if not exists corporate_rollout_days_site_idx
  on public.corporate_rollout_days (programme_id, site_key);
