create table public.customer_popup_impressions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  popup_kind text not null check (char_length(popup_kind) between 1 and 60),
  knowledge_object_id uuid references public.knowledge_objects(id) on delete set null,
  shown_at timestamptz not null default now(),
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index customer_popup_impressions_customer_kind_idx
  on public.customer_popup_impressions (customer_id, popup_kind, shown_at desc);

alter table public.customer_popup_impressions enable row level security;

create policy "platform staff read popup impressions"
  on public.customer_popup_impressions for select to authenticated
  using (public.is_platform_staff());

create policy "retailer managers read popup impressions"
  on public.customer_popup_impressions for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  );

-- Caller is always the customer's own storefront session (customer_portal
-- source, see capture_behavioral_event's equivalent branch in
-- 20260730240000_add_interaction_session_context.sql) recording an
-- impression about themselves — not retailer staff. Authorization checks
-- that auth.uid() actually owns the target customer_id row, rather than
-- checking a retailer staff role a real customer session will never have.
create or replace function public.record_popup_impression(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_popup_kind text,
  p_knowledge_object_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_popup_kind is null or char_length(p_popup_kind) not between 1 and 60 then
    raise exception 'Invalid popup_kind';
  end if;

  if auth.uid() is not null then
    if not exists (
      select 1 from public.customers c
      where c.id = p_customer_id
        and c.retailer_id = p_retailer_id
        and c.user_id = auth.uid()
    ) then
      raise exception 'Customer relationship required';
    end if;
  elsif current_user not in ('service_role', 'postgres') then
    raise exception 'Authentication required';
  end if;

  insert into public.customer_popup_impressions (
    retailer_id, customer_id, popup_kind, knowledge_object_id
  ) values (
    p_retailer_id, p_customer_id, p_popup_kind, p_knowledge_object_id
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.record_popup_impression(uuid, uuid, text, uuid) from public;
grant execute on function public.record_popup_impression(uuid, uuid, text, uuid)
  to authenticated, service_role;

comment on table public.customer_popup_impressions is
  'Tracks popup impressions (nudges, etc.) shown to customers for frequency-capping and audit.';
