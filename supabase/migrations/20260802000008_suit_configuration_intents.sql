-- FT-07 Lapel/pocket/shoulder configurator (docs/FOUNDER_TOOL_BLUEPRINTS.md) —
-- a customer's saved lapel/pockets/shoulder selection, optionally pinned to
-- one of the source's three predefined coherent models. Append-only: each
-- save is a new row, so an advisor can see the customer's exploration, not
-- just their latest pick.

create table public.suit_configuration_intents (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  lapel text not null check (lapel in ('notch', 'peak', 'shawl', 'double_breasted')),
  pockets text not null check (pockets in ('flap', 'jetted', 'patched')),
  shoulder text not null check (shoulder in ('classic', 'natural', 'roped', 'spalla_camicia')),
  model_preset smallint check (model_preset in (1, 2, 3)),
  created_at timestamptz not null default now()
);

create index suit_configuration_intents_customer_idx
  on public.suit_configuration_intents (customer_id, created_at desc);
create index suit_configuration_intents_retailer_idx
  on public.suit_configuration_intents (retailer_id, created_at desc);

alter table public.suit_configuration_intents enable row level security;

create policy "platform staff can manage all suit configuration intents"
  on public.suit_configuration_intents for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "a customer can read their own suit configuration intents"
  on public.suit_configuration_intents for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = suit_configuration_intents.customer_id
        and c.user_id = auth.uid()
    )
  );

-- Same clienteling rationale as wishlists (20260720000011): a client's
-- explored design intent is as relevant to an advisor as their saved
-- products or order history.
create policy "retailer staff can read their retailer's configuration intents"
  on public.suit_configuration_intents for select
  using (retailer_id = public.current_retailer_id());

comment on table public.suit_configuration_intents is
  'A customer''s saved lapel/pockets/shoulder pick. Written only by save_suit_configuration_intent().';

-- Same shape as toggle_wishlist_item (20260720000011): a narrow RPC that
-- re-derives the caller's Customer row (self-creating it on a first
-- interaction) rather than trusting a client-supplied customer id.
create or replace function public.save_suit_configuration_intent(
  p_retailer_id uuid,
  p_lapel text,
  p_pockets text,
  p_shoulder text,
  p_model_preset smallint default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select id into v_customer_id from public.customers
    where retailer_id = p_retailer_id and user_id = auth.uid() and deleted_at is null
    limit 1;
  if v_customer_id is null then
    insert into public.customers (retailer_id, user_id, full_name, email, lifecycle_stage)
    values (p_retailer_id, auth.uid(), coalesce(auth.jwt() ->> 'email', 'Customer'), auth.jwt() ->> 'email', 'prospect')
    returning id into v_customer_id;
    insert into public.customer_account_links (user_id, customer_id, retailer_id)
    values (auth.uid(), v_customer_id, p_retailer_id)
    on conflict (user_id, customer_id) do nothing;
  end if;

  insert into public.suit_configuration_intents
    (retailer_id, customer_id, lapel, pockets, shoulder, model_preset)
    values (p_retailer_id, v_customer_id, p_lapel, p_pockets, p_shoulder, p_model_preset)
    returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.save_suit_configuration_intent(uuid, text, text, text, smallint) from public;
grant execute on function public.save_suit_configuration_intent(uuid, text, text, text, smallint)
  to authenticated, service_role;

grant select on public.suit_configuration_intents to authenticated, service_role;
