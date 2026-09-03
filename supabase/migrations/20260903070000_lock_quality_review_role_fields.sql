-- PHASE 12.3 security follow-up: service_partner_quality_reviews_customer_update
-- (20260801000009) scopes row ownership correctly but has no column
-- restriction — a customer with a valid session can UPDATE their own review
-- row's retailer_rating/retailer_note directly via PostgREST, bypassing the
-- Server Action's field allow-list. The table's own comment says exactly why
-- that must not happen: "Retailer's own assessment and, separately, what the
-- customer said. Collapsing them would let a retailer's opinion be reported
-- as the customer's." RLS alone cannot express "this role may touch these
-- columns but not those" on the same row, so lock it with a trigger.
--
-- Mirrors this table's own retailer-side symmetry: an authenticated caller
-- with no retailer_role (i.e. the customer path — see current_retailer_role())
-- may not change retailer_rating/retailer_note/partner_id/engagement_id/
-- retailer_id; a caller WITH a retailer_role may not change
-- customer_rating/customer_note. Staff-only columns beyond the review pair
-- (partner_id, engagement_id, retailer_id) are locked for everyone except
-- service_role, since neither RLS policy's WITH CHECK currently re-derives
-- them from the row being updated.

create or replace function public.lock_quality_review_role_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_setting('role', true) = 'service_role' then
    return new;
  end if;

  if public.current_retailer_role() is null then
    -- Customer path: may only ever change their own two fields.
    if new.retailer_rating is distinct from old.retailer_rating
      or new.retailer_note is distinct from old.retailer_note
    then
      raise exception
        'customers may not set retailer_rating or retailer_note'
        using errcode = '42501';
    end if;
  else
    -- Retailer-staff path: may only ever change their own two fields.
    if new.customer_rating is distinct from old.customer_rating
      or new.customer_note is distinct from old.customer_note
    then
      raise exception
        'retailer staff may not set customer_rating or customer_note'
        using errcode = '42501';
    end if;
  end if;

  -- No caller (customer or staff) may reassign a review to a different
  -- engagement/partner/retailer through an update — that is a delete+insert,
  -- not a correction.
  if new.engagement_id is distinct from old.engagement_id
    or new.partner_id is distinct from old.partner_id
    or new.retailer_id is distinct from old.retailer_id
  then
    raise exception
      'engagement_id, partner_id and retailer_id are immutable on update'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.lock_quality_review_role_fields() from public;

drop trigger if exists lock_quality_review_role_fields
  on public.service_partner_quality_reviews;
create trigger lock_quality_review_role_fields
  before update on public.service_partner_quality_reviews
  for each row
  execute function public.lock_quality_review_role_fields();
