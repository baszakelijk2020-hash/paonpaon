-- PHASE 11.3 defect fix: a coverage plan with no branch was never unique.
--
-- `20260801000005` declared:
--   constraint coverage_plans_unique_day unique (retailer_id, branch_id, plan_date)
--
-- `branch_id` is nullable (null means the whole retailer, i.e. a single-site
-- shop or an HQ-level plan). Postgres treats NULLs as DISTINCT in a UNIQUE
-- constraint by default, so two rows with the same retailer and date but a
-- null branch both insert happily. Verified against the sandbox project
-- before writing this: two identical inserts produced
-- `duplicate_rows: 2`.
--
-- Three consequences, in increasing order of how badly they bite:
--   1. The uniqueness the constraint appears to promise does not hold for
--      exactly the common case — a shop with one location.
--   2. `CoveragePlanningRepository.saveDraftPlan` upserts with
--      `onConflict: "retailer_id,branch_id,plan_date"`. That conflict target
--      can never match a null-branch row, so every save created ANOTHER
--      plan instead of replacing the draft.
--   3. `findPlanForDate` then reads with `.maybeSingle()`, which throws on
--      multiple rows. So the second save would break the page that reads it.
--
-- Postgres 15 added `NULLS NOT DISTINCT`, and this project runs 17.6, so the
-- honest fix is to say what was meant: one plan per retailer per branch per
-- day, treating "no branch" as a value rather than as unknown. Semantically
-- that is correct — a null branch here is not missing information, it is the
-- specific statement "this plan covers the whole retailer".

-- Clean up any duplicates a caller may already have created, keeping the
-- earliest row per (retailer, branch, date). Intervals cascade from the
-- plan, so the later duplicates take their (unpublished, unused) intervals
-- with them.
delete from public.coverage_plans p
using public.coverage_plans keep
where p.retailer_id = keep.retailer_id
  and p.plan_date = keep.plan_date
  and p.branch_id is null
  and keep.branch_id is null
  and (p.created_at, p.id) > (keep.created_at, keep.id);

alter table public.coverage_plans
  drop constraint if exists coverage_plans_unique_day;

alter table public.coverage_plans
  add constraint coverage_plans_unique_day
  unique nulls not distinct (retailer_id, branch_id, plan_date);

comment on constraint coverage_plans_unique_day on public.coverage_plans is
  'NULLS NOT DISTINCT on purpose: a null branch_id is the statement "this '
  'plan covers the whole retailer", not missing information, so two '
  'whole-retailer plans for one date must collide.';
