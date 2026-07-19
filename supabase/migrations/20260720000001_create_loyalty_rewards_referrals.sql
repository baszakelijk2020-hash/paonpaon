create type public.loyalty_tier as enum ('member', 'silver', 'gold', 'platinum');
create type public.loyalty_entry_type as enum ('earn_purchase', 'earn_referral', 'earn_bonus', 'redeem_reward', 'adjustment_expiry', 'adjustment_manual');
create type public.reward_type as enum ('discount_percent', 'discount_fixed', 'gift', 'early_access');
create type public.redemption_status as enum ('issued', 'used', 'cancelled');
create type public.referral_status as enum ('invited', 'signed_up', 'first_purchase_completed', 'rewarded');

create table public.loyalty_programs (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null unique references public.retailers(id) on delete cascade,
  name text not null default 'Loyalty programme',
  enabled boolean not null default true,
  points_per_currency_unit integer not null default 1 check (points_per_currency_unit >= 0),
  referral_points integer not null default 500 check (referral_points >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create trigger set_loyalty_programs_updated_at before update on public.loyalty_programs for each row execute function public.set_updated_at();

create table public.loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  tier public.loyalty_tier not null default 'member',
  points_balance integer not null default 0 check (points_balance >= 0),
  lifetime_points integer not null default 0 check (lifetime_points >= 0),
  tier_anniversary_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (retailer_id, customer_id)
);
create index loyalty_accounts_customer_idx on public.loyalty_accounts(customer_id);
create trigger set_loyalty_accounts_updated_at before update on public.loyalty_accounts for each row execute function public.set_updated_at();

create table public.loyalty_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  loyalty_account_id uuid not null references public.loyalty_accounts(id) on delete cascade,
  type public.loyalty_entry_type not null,
  points integer not null check (points <> 0),
  related_order_id uuid references public.orders(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index loyalty_ledger_account_idx on public.loyalty_ledger_entries(loyalty_account_id, created_at desc);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  name text not null,
  type public.reward_type not null,
  points_cost integer not null check (points_cost > 0),
  minimum_tier public.loyalty_tier,
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index rewards_retailer_idx on public.rewards(retailer_id);
create trigger set_rewards_updated_at before update on public.rewards for each row execute function public.set_updated_at();

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  loyalty_account_id uuid not null references public.loyalty_accounts(id) on delete cascade,
  reward_id uuid not null references public.rewards(id),
  points_spent integer not null check (points_spent > 0),
  status public.redemption_status not null default 'issued',
  code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  created_at timestamptz not null default now(), used_at timestamptz
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  referring_customer_id uuid not null references public.customers(id) on delete cascade,
  referred_email text not null,
  referred_customer_id uuid references public.customers(id) on delete set null,
  status public.referral_status not null default 'invited',
  reward_id uuid references public.rewards(id) on delete set null,
  code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (retailer_id, referring_customer_id, referred_email)
);
create index referrals_retailer_idx on public.referrals(retailer_id);
create trigger set_referrals_updated_at before update on public.referrals for each row execute function public.set_updated_at();

alter table public.loyalty_programs enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_ledger_entries enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.referrals enable row level security;

create policy "platform manages loyalty programs" on public.loyalty_programs for all using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "retailer reads loyalty program" on public.loyalty_programs for select using (retailer_id = public.current_retailer_id());
create policy "retailer managers manage loyalty program" on public.loyalty_programs for all using (retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('manager','admin','owner')) with check (retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('manager','admin','owner'));

create policy "platform manages loyalty accounts" on public.loyalty_accounts for all using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "retailer reads loyalty accounts" on public.loyalty_accounts for select using (retailer_id = public.current_retailer_id());
create policy "customer reads own loyalty accounts" on public.loyalty_accounts for select using (exists (select 1 from public.customers c where c.id = customer_id and c.user_id = auth.uid()));

create policy "platform manages loyalty ledger" on public.loyalty_ledger_entries for all using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "retailer reads loyalty ledger" on public.loyalty_ledger_entries for select using (exists (select 1 from public.loyalty_accounts a where a.id = loyalty_account_id and a.retailer_id = public.current_retailer_id()));
create policy "customer reads own loyalty ledger" on public.loyalty_ledger_entries for select using (exists (select 1 from public.loyalty_accounts a join public.customers c on c.id = a.customer_id where a.id = loyalty_account_id and c.user_id = auth.uid()));

create policy "platform manages rewards" on public.rewards for all using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "retailer reads rewards" on public.rewards for select using (retailer_id = public.current_retailer_id());
create policy "retailer managers manage rewards" on public.rewards for all using (retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('manager','admin','owner')) with check (retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('manager','admin','owner'));
create policy "customer reads active rewards" on public.rewards for select using (active and deleted_at is null and exists (select 1 from public.customers c where c.retailer_id = rewards.retailer_id and c.user_id = auth.uid()));

create policy "platform manages redemptions" on public.reward_redemptions for all using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "retailer reads redemptions" on public.reward_redemptions for select using (exists (select 1 from public.loyalty_accounts a where a.id = loyalty_account_id and a.retailer_id = public.current_retailer_id()));
create policy "customer reads own redemptions" on public.reward_redemptions for select using (exists (select 1 from public.loyalty_accounts a join public.customers c on c.id = a.customer_id where a.id = loyalty_account_id and c.user_id = auth.uid()));

create policy "platform manages referrals" on public.referrals for all using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "retailer reads referrals" on public.referrals for select using (retailer_id = public.current_retailer_id());
create policy "customer reads own referrals" on public.referrals for select using (exists (select 1 from public.customers c where c.id = referring_customer_id and c.user_id = auth.uid()));

create or replace function public.ensure_my_loyalty_account(p_retailer_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_customer_id uuid; v_account_id uuid;
begin
  select id into v_customer_id from public.customers where retailer_id = p_retailer_id and user_id = auth.uid() and deleted_at is null;
  if v_customer_id is null then raise exception 'No customer relationship exists for this retailer'; end if;
  insert into public.loyalty_programs(retailer_id) values (p_retailer_id) on conflict (retailer_id) do nothing;
  insert into public.loyalty_accounts(retailer_id, customer_id) values (p_retailer_id, v_customer_id)
    on conflict (retailer_id, customer_id) do update set updated_at = public.loyalty_accounts.updated_at returning id into v_account_id;
  return v_account_id;
end $$;

create or replace function public.create_my_referral(p_retailer_id uuid, p_referred_email text) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_customer_id uuid; v_id uuid;
begin
  select id into v_customer_id from public.customers where retailer_id = p_retailer_id and user_id = auth.uid() and deleted_at is null;
  if v_customer_id is null then raise exception 'No customer relationship exists for this retailer'; end if;
  if lower(p_referred_email) = lower(coalesce(auth.jwt()->>'email','')) then raise exception 'You cannot refer yourself'; end if;
  insert into public.referrals(retailer_id, referring_customer_id, referred_email)
    values (p_retailer_id, v_customer_id, lower(trim(p_referred_email)))
    on conflict (retailer_id, referring_customer_id, referred_email) do update set updated_at = now()
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.redeem_my_reward(p_reward_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_reward public.rewards%rowtype; v_customer_id uuid; v_account public.loyalty_accounts%rowtype; v_id uuid;
begin
  select * into v_reward from public.rewards where id = p_reward_id and active and deleted_at is null for update;
  if not found then raise exception 'Reward unavailable'; end if;
  select id into v_customer_id from public.customers where retailer_id = v_reward.retailer_id and user_id = auth.uid() and deleted_at is null;
  select * into v_account from public.loyalty_accounts where retailer_id = v_reward.retailer_id and customer_id = v_customer_id for update;
  if v_account.id is null or v_account.points_balance < v_reward.points_cost then raise exception 'Insufficient points'; end if;
  update public.loyalty_accounts set points_balance = points_balance - v_reward.points_cost where id = v_account.id;
  insert into public.loyalty_ledger_entries(loyalty_account_id, type, points, note) values (v_account.id, 'redeem_reward', -v_reward.points_cost, 'Reward redeemed');
  insert into public.reward_redemptions(loyalty_account_id, reward_id, points_spent) values (v_account.id, v_reward.id, v_reward.points_cost) returning id into v_id;
  return v_id;
end $$;

create or replace function public.accrue_loyalty_on_delivered_order() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_program public.loyalty_programs%rowtype; v_account_id uuid; v_points integer;
begin
  if new.status <> 'delivered' or old.status = 'delivered' then return new; end if;
  select * into v_program from public.loyalty_programs where retailer_id = new.retailer_id and enabled and deleted_at is null;
  if not found then return new; end if;
  insert into public.loyalty_accounts(retailer_id, customer_id) values (new.retailer_id, new.customer_id) on conflict (retailer_id, customer_id) do update set updated_at = now() returning id into v_account_id;
  v_points := floor(new.total_amount_minor_units / 100.0)::integer * v_program.points_per_currency_unit;
  if v_points > 0 and not exists (select 1 from public.loyalty_ledger_entries where related_order_id = new.id and type = 'earn_purchase') then
    insert into public.loyalty_ledger_entries(loyalty_account_id, type, points, related_order_id, note) values (v_account_id, 'earn_purchase', v_points, new.id, 'Points earned from delivered order');
    update public.loyalty_accounts set points_balance = points_balance + v_points, lifetime_points = lifetime_points + v_points where id = v_account_id;
  end if;
  return new;
end $$;
create trigger accrue_loyalty_after_delivery after update of status on public.orders for each row execute function public.accrue_loyalty_on_delivered_order();

revoke all on function public.ensure_my_loyalty_account(uuid) from public;
revoke all on function public.create_my_referral(uuid, text) from public;
revoke all on function public.redeem_my_reward(uuid) from public;
grant execute on function public.ensure_my_loyalty_account(uuid) to authenticated, service_role;
grant execute on function public.create_my_referral(uuid, text) to authenticated, service_role;
grant execute on function public.redeem_my_reward(uuid) to authenticated, service_role;

grant select, insert, update, delete on public.loyalty_programs, public.loyalty_accounts, public.loyalty_ledger_entries, public.rewards, public.reward_redemptions, public.referrals to authenticated, service_role;
