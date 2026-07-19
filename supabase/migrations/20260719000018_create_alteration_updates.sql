-- See packages/domain/src/production/production.ts "AlterationUpdate"
-- and docs/DECISIONS.md ADR-015. Append-only — the trigger at the
-- bottom of this file is what keeps `alterations.status` in sync,
-- never application code, so the two can never drift apart regardless
-- of which future code path inserts an update.

create table public.alteration_updates (
  id uuid primary key default gen_random_uuid(),
  alteration_id uuid not null references public.alterations (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  status public.alteration_status not null,
  note text,
  staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index alteration_updates_alteration_id_idx
  on public.alteration_updates (alteration_id, created_at);

alter table public.alteration_updates enable row level security;

create policy "platform staff can manage all alteration updates"
  on public.alteration_updates for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "retailer staff can read their retailer's alteration updates"
  on public.alteration_updates for select
  using (retailer_id = public.current_retailer_id());

-- Status/progress tracking is the actual alteration work — same gate
-- as orders' fulfillment-status policy (production_staff+), distinct
-- from the sales_associate+ gate that creates/edits the request itself
-- (previous migration).
create policy "production staff and above can add alteration updates"
  on public.alteration_updates for insert
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() <> 'read_only'
  );

create policy "a customer can read their own alteration updates"
  on public.alteration_updates for select
  using (
    exists (
      select 1 from public.alterations a
      join public.customers c on c.id = a.customer_id
      where a.id = alteration_updates.alteration_id
        and c.user_id = auth.uid()
    )
  );

comment on table public.alteration_updates is
  'Append-only status/note timeline for an Alteration — how a customer "sees updates" and how alterations.status stays in sync (see the trigger below).';

create or replace function public.sync_alteration_status_from_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.alterations
    set status = new.status
    where id = new.alteration_id;
  return new;
end;
$$;

create trigger sync_alteration_status_on_update_insert
  after insert on public.alteration_updates
  for each row
  execute function public.sync_alteration_status_from_update();
