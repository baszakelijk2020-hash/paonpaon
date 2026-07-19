-- ADR-025. Completes the referral acquisition journey ADR-017/
-- create_my_referral left as "invited": a referral now progresses to
-- signed_up when the referred email links to a Customer Portal login
-- at the referring retailer, to first_purchase_completed on that
-- customer's first delivered order there, and to rewarded once the
-- referrer's loyalty account is credited referral_points.

-- Signup matching: fires whenever a customers row gains a user_id
-- (insert with one already set — place_order/add_to_cart/
-- request_appointment's inline Customer creation — or an update from
-- link_my_customer_accounts linking an existing prospect record).
create or replace function public.match_referral_on_customer_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null then
    return new;
  end if;

  update public.referrals
    set referred_customer_id = new.id, status = 'signed_up'
    where retailer_id = new.retailer_id
      and status = 'invited'
      and referred_customer_id is null
      and lower(referred_email) = lower(new.email);

  return new;
end;
$$;

create trigger match_referral_after_customer_link
  after insert or update of user_id on public.customers
  for each row
  when (new.user_id is not null)
  execute function public.match_referral_on_customer_signup();

-- Purchase matching + reward issuance: extends the existing
-- "order reaches delivered" trigger (20260720000001_*) rather than
-- adding a second trigger on the same event — both concerns react to
-- the same transition and share the loyalty-account-ensure step.
create or replace function public.accrue_loyalty_on_delivered_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_program public.loyalty_programs%rowtype;
  v_account_id uuid;
  v_points integer;
  v_referral public.referrals%rowtype;
  v_referrer_account_id uuid;
begin
  if new.status <> 'delivered' or old.status = 'delivered' then return new; end if;

  select * into v_program from public.loyalty_programs where retailer_id = new.retailer_id and enabled and deleted_at is null;
  if found then
    insert into public.loyalty_accounts(retailer_id, customer_id) values (new.retailer_id, new.customer_id) on conflict (retailer_id, customer_id) do update set updated_at = now() returning id into v_account_id;
    v_points := floor(new.total_amount_minor_units / 100.0)::integer * v_program.points_per_currency_unit;
    if v_points > 0 and not exists (select 1 from public.loyalty_ledger_entries where related_order_id = new.id and type = 'earn_purchase') then
      insert into public.loyalty_ledger_entries(loyalty_account_id, type, points, related_order_id, note) values (v_account_id, 'earn_purchase', v_points, new.id, 'Points earned from delivered order');
      update public.loyalty_accounts set points_balance = points_balance + v_points, lifetime_points = lifetime_points + v_points where id = v_account_id;
    end if;
  end if;

  -- Referral conversion requires this to be the referred customer's
  -- first-ever delivered order at this retailer — a repeat purchase
  -- from an already-converted referral does not re-trigger a reward
  -- (status is no longer 'signed_up' once converted).
  select * into v_referral from public.referrals
    where referred_customer_id = new.customer_id
      and retailer_id = new.retailer_id
      and status = 'signed_up'
    for update;

  if found
    and not exists (
      select 1 from public.orders
      where customer_id = new.customer_id
        and retailer_id = new.retailer_id
        and status = 'delivered'
        and deleted_at is null
        and id <> new.id
    )
  then
    update public.referrals set status = 'first_purchase_completed' where id = v_referral.id;

    if v_program.id is not null and v_program.referral_points > 0 then
      insert into public.loyalty_accounts(retailer_id, customer_id) values (new.retailer_id, v_referral.referring_customer_id) on conflict (retailer_id, customer_id) do update set updated_at = now() returning id into v_referrer_account_id;
      insert into public.loyalty_ledger_entries(loyalty_account_id, type, points, note) values (v_referrer_account_id, 'earn_referral', v_program.referral_points, 'Referral reward: ' || v_referral.referred_email);
      update public.loyalty_accounts set points_balance = points_balance + v_program.referral_points, lifetime_points = lifetime_points + v_program.referral_points where id = v_referrer_account_id;
      update public.referrals set status = 'rewarded' where id = v_referral.id;
    end if;
  end if;

  return new;
end;
$$;
