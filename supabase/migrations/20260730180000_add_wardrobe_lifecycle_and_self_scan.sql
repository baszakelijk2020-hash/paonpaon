-- PAON Intelligence Platform Stage 4.3.
-- Wardrobe lifecycle history, customer self-scan, fit freshness inputs,
-- and private attachment storage (WARD-002, FIT-001–003, LONG-001, ADR-016/055/063).
-- Self reports never populate official fitting_observations.

-- ---------------------------------------------------------------------------
-- wardrobe_lifecycle_events — append-only care/wear/rest history
-- ---------------------------------------------------------------------------

create table if not exists public.wardrobe_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  wardrobe_item_id uuid not null references public.wardrobe_items (id) on delete cascade,
  event_kind text not null check (
    event_kind in (
      'wear_logged',
      'rested',
      'cleaned',
      'repaired',
      'care_due_acknowledged'
    )
  ),
  note text check (note is null or length(btrim(note)) between 1 and 500),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint wardrobe_lifecycle_events_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate
);

create index if not exists wardrobe_lifecycle_events_item_idx
  on public.wardrobe_lifecycle_events (wardrobe_item_id, occurred_at desc);

comment on table public.wardrobe_lifecycle_events is
  'Append-only wardrobe lifecycle history (care, wear, repair). Not official fit.';

alter table public.wardrobe_lifecycle_events enable row level security;
revoke all on table public.wardrobe_lifecycle_events from anon;

create policy "customers read own wardrobe lifecycle events"
  on public.wardrobe_lifecycle_events for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = wardrobe_lifecycle_events.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant wardrobe lifecycle events"
  on public.wardrobe_lifecycle_events for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read wardrobe lifecycle events"
  on public.wardrobe_lifecycle_events for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.wardrobe_lifecycle_events
  to authenticated, service_role;
grant all on table public.wardrobe_lifecycle_events to service_role;

-- ---------------------------------------------------------------------------
-- wardrobe_self_reports — customer self-scan notes (never official fit)
-- ---------------------------------------------------------------------------

create table if not exists public.wardrobe_self_reports (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  wardrobe_item_id uuid not null references public.wardrobe_items (id) on delete cascade,
  provenance text not null default 'customer_self_reported' check (
    provenance = 'customer_self_reported'
  ),
  notes text check (notes is null or length(btrim(notes)) between 1 and 2000),
  fit_perception text check (
    fit_perception is null
    or fit_perception in (
      'unknown',
      'true_to_size',
      'slightly_tight',
      'slightly_loose',
      'needs_alteration'
    )
  ),
  order_line_id uuid references public.order_lines (id) on delete set null,
  physical_garment_id uuid references public.physical_garments (id) on delete set null,
  reported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wardrobe_self_reports_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate
);

create index if not exists wardrobe_self_reports_item_idx
  on public.wardrobe_self_reports (wardrobe_item_id, reported_at desc);

create index if not exists wardrobe_self_reports_customer_idx
  on public.wardrobe_self_reports (customer_id, reported_at desc);

comment on table public.wardrobe_self_reports is
  'Customer self-scan fit notes and photos metadata. Never official measurements.';

create trigger set_wardrobe_self_reports_updated_at
  before update on public.wardrobe_self_reports
  for each row execute function public.set_updated_at();

alter table public.wardrobe_self_reports enable row level security;
revoke all on table public.wardrobe_self_reports from anon;

create policy "customers read own wardrobe self reports"
  on public.wardrobe_self_reports for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = wardrobe_self_reports.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant wardrobe self reports"
  on public.wardrobe_self_reports for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read wardrobe self reports"
  on public.wardrobe_self_reports for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.wardrobe_self_reports
  to authenticated, service_role;
grant all on table public.wardrobe_self_reports to service_role;

-- ---------------------------------------------------------------------------
-- wardrobe_attachments — private self-scan photo metadata
-- ---------------------------------------------------------------------------

create table if not exists public.wardrobe_attachments (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  wardrobe_item_id uuid not null references public.wardrobe_items (id) on delete cascade,
  self_report_id uuid references public.wardrobe_self_reports (id) on delete set null,
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path),
  constraint wardrobe_attachments_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate
);

create index if not exists wardrobe_attachments_item_idx
  on public.wardrobe_attachments (wardrobe_item_id, created_at desc);

alter table public.wardrobe_attachments enable row level security;
revoke all on table public.wardrobe_attachments from anon;

create policy "customers read own wardrobe attachments"
  on public.wardrobe_attachments for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = wardrobe_attachments.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant wardrobe attachments"
  on public.wardrobe_attachments for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read wardrobe attachments"
  on public.wardrobe_attachments for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.wardrobe_attachments
  to authenticated, service_role;
grant all on table public.wardrobe_attachments to service_role;

-- ---------------------------------------------------------------------------
-- wardrobe_guidance_dismissals — customer-dismissed longevity guidance
-- ---------------------------------------------------------------------------

create table if not exists public.wardrobe_guidance_dismissals (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  wardrobe_item_id uuid not null references public.wardrobe_items (id) on delete cascade,
  guidance_key text not null check (
    length(btrim(guidance_key)) between 1 and 200
  ),
  dismissed_at timestamptz not null default now(),
  unique (customer_id, guidance_key),
  constraint wardrobe_guidance_dismissals_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate
);

create index if not exists wardrobe_guidance_dismissals_item_idx
  on public.wardrobe_guidance_dismissals (wardrobe_item_id);

alter table public.wardrobe_guidance_dismissals enable row level security;
revoke all on table public.wardrobe_guidance_dismissals from anon;

create policy "customers read own wardrobe guidance dismissals"
  on public.wardrobe_guidance_dismissals for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = wardrobe_guidance_dismissals.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant wardrobe guidance dismissals"
  on public.wardrobe_guidance_dismissals for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

grant select, insert on table public.wardrobe_guidance_dismissals
  to authenticated, service_role;
grant all on table public.wardrobe_guidance_dismissals to service_role;

-- ---------------------------------------------------------------------------
-- Private storage bucket for wardrobe self-scan photos
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wardrobe-private',
  'wardrobe-private',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create or replace function public.can_access_wardrobe_storage_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  v_folders text[] := storage.foldername(p_name);
  v_retailer_id uuid;
  v_customer_id uuid;
begin
  if public.is_platform_staff() then return true; end if;
  if array_length(v_folders, 1) < 2 then return false; end if;
  begin
    v_retailer_id := v_folders[1]::uuid;
    v_customer_id := v_folders[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  if exists (
    select 1 from public.customers c
    where c.id = v_customer_id
      and c.retailer_id = v_retailer_id
      and c.user_id = auth.uid()
      and c.deleted_at is null
  ) then
    return true;
  end if;
  if v_retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in (
      'sales_associate', 'manager', 'admin', 'owner'
    ) then
    return true;
  end if;
  return false;
end;
$$;

revoke all on function public.can_access_wardrobe_storage_object(text) from public;
grant execute on function public.can_access_wardrobe_storage_object(text)
  to authenticated, service_role;

create policy "wardrobe private read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'wardrobe-private'
    and public.can_access_wardrobe_storage_object(name)
  );

create policy "wardrobe private insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'wardrobe-private'
    and public.can_access_wardrobe_storage_object(name)
  );

-- ---------------------------------------------------------------------------
-- RPC: record wardrobe lifecycle event (customer or advisor)
-- ---------------------------------------------------------------------------

create or replace function public.record_wardrobe_lifecycle_event(
  p_wardrobe_item_id uuid,
  p_event_kind text,
  p_note text default null,
  p_occurred_at timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.wardrobe_items%rowtype;
  v_staff public.retailer_staff_members%rowtype;
  v_event_id uuid;
begin
  select * into v_item
  from public.wardrobe_items
  where id = p_wardrobe_item_id
    and deleted_at is null;
  if not found then raise exception 'Wardrobe item not found'; end if;

  select * into v_staff
  from public.retailer_staff_members
  where retailer_id = v_item.retailer_id
    and user_id = auth.uid()
    and accepted_at is not null
    and deleted_at is null;

  if not (
    exists (
      select 1 from public.customers c
      where c.id = v_item.customer_id
        and c.user_id = auth.uid()
        and c.deleted_at is null
    )
    or (
      v_staff.id is not null
      and v_staff.role in ('sales_associate', 'manager', 'admin', 'owner')
    )
  ) then
    raise exception 'Not authorized';
  end if;

  if p_event_kind not in (
    'wear_logged', 'rested', 'cleaned', 'repaired', 'care_due_acknowledged'
  ) then
    raise exception 'Invalid lifecycle event kind';
  end if;

  insert into public.wardrobe_lifecycle_events (
    retailer_id,
    customer_id,
    wardrobe_item_id,
    event_kind,
    note,
    occurred_at
  ) values (
    v_item.retailer_id,
    v_item.customer_id,
    v_item.id,
    p_event_kind,
    nullif(btrim(p_note), ''),
    coalesce(p_occurred_at, now())
  ) returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.record_wardrobe_lifecycle_event(uuid, text, text, timestamptz) from public;
grant execute on function public.record_wardrobe_lifecycle_event(uuid, text, text, timestamptz)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: record wardrobe self-scan report (customer only)
-- ---------------------------------------------------------------------------

create or replace function public.record_wardrobe_self_report(
  p_wardrobe_item_id uuid,
  p_notes text default null,
  p_fit_perception text default null,
  p_storage_path text default null,
  p_file_name text default null,
  p_mime_type text default null,
  p_size_bytes bigint default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.wardrobe_items%rowtype;
  v_customer public.customers%rowtype;
  v_order_status text;
  v_report_id uuid;
  v_attachment_id uuid;
begin
  select * into v_item
  from public.wardrobe_items
  where id = p_wardrobe_item_id
    and deleted_at is null;
  if not found then raise exception 'Wardrobe item not found'; end if;

  select * into v_customer
  from public.customers
  where id = v_item.customer_id
    and user_id = auth.uid()
    and deleted_at is null;
  if not found then raise exception 'Not authorized'; end if;

  if v_item.condition = 'retired' or v_item.retired_at is not null then
    raise exception 'Retired wardrobe items cannot accept self-scan';
  end if;

  if v_item.ownership_kind = 'external'
    and v_item.order_line_id is null
    and v_item.physical_garment_id is null then
    raise exception 'External items need a purchase or service link for self-scan';
  end if;

  if v_item.order_line_id is not null then
    select ord.status into v_order_status
    from public.order_lines as line
    join public.orders as ord on ord.id = line.order_id
    where line.id = v_item.order_line_id
      and ord.deleted_at is null;
    if v_order_status is null
      or v_order_status not in (
        'ready_for_fulfillment', 'shipped', 'delivered', 'completed'
      ) then
      raise exception 'Order line is not yet eligible for self-scan';
    end if;
  end if;

  insert into public.wardrobe_self_reports (
    retailer_id,
    customer_id,
    wardrobe_item_id,
    notes,
    fit_perception,
    order_line_id,
    physical_garment_id
  ) values (
    v_item.retailer_id,
    v_item.customer_id,
    v_item.id,
    nullif(btrim(p_notes), ''),
    nullif(btrim(p_fit_perception), ''),
    v_item.order_line_id,
    v_item.physical_garment_id
  ) returning id into v_report_id;

  if p_storage_path is not null and p_file_name is not null
    and p_mime_type is not null and p_size_bytes is not null then
    insert into public.wardrobe_attachments (
      retailer_id,
      customer_id,
      wardrobe_item_id,
      self_report_id,
      storage_bucket,
      storage_path,
      file_name,
      mime_type,
      size_bytes
    ) values (
      v_item.retailer_id,
      v_item.customer_id,
      v_item.id,
      v_report_id,
      'wardrobe-private',
      p_storage_path,
      p_file_name,
      p_mime_type,
      p_size_bytes
    ) returning id into v_attachment_id;
  end if;

  if p_fit_perception is not null then
    update public.wardrobe_items
    set fit_perception = p_fit_perception,
        fit_notes = coalesce(nullif(btrim(p_notes), ''), fit_notes),
        updated_at = now()
    where id = v_item.id;
  elsif p_notes is not null then
    update public.wardrobe_items
    set fit_notes = coalesce(nullif(btrim(p_notes), ''), fit_notes),
        updated_at = now()
    where id = v_item.id;
  end if;

  return v_report_id;
end;
$$;

revoke all on function public.record_wardrobe_self_report(uuid, text, text, text, text, text, bigint) from public;
grant execute on function public.record_wardrobe_self_report(uuid, text, text, text, text, text, bigint)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: dismiss wardrobe guidance (customer only)
-- ---------------------------------------------------------------------------

create or replace function public.dismiss_wardrobe_guidance(
  p_wardrobe_item_id uuid,
  p_guidance_key text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.wardrobe_items%rowtype;
  v_dismissal_id uuid;
begin
  select * into v_item
  from public.wardrobe_items
  where id = p_wardrobe_item_id
    and deleted_at is null;
  if not found then raise exception 'Wardrobe item not found'; end if;

  if not exists (
    select 1 from public.customers c
    where c.id = v_item.customer_id
      and c.user_id = auth.uid()
      and c.deleted_at is null
  ) then
    raise exception 'Not authorized';
  end if;

  insert into public.wardrobe_guidance_dismissals (
    retailer_id,
    customer_id,
    wardrobe_item_id,
    guidance_key
  ) values (
    v_item.retailer_id,
    v_item.customer_id,
    v_item.id,
    btrim(p_guidance_key)
  )
  on conflict (customer_id, guidance_key) do update
    set dismissed_at = excluded.dismissed_at
  returning id into v_dismissal_id;

  return v_dismissal_id;
end;
$$;

revoke all on function public.dismiss_wardrobe_guidance(uuid, text) from public;
grant execute on function public.dismiss_wardrobe_guidance(uuid, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: latest official fitting date for a wardrobe item (read projection)
-- ---------------------------------------------------------------------------

create or replace function public.latest_official_fitting_at(
  p_wardrobe_item_id uuid
) returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(session.occurred_at)
  from public.wardrobe_items as item
  join public.physical_garments as garment
    on garment.id = item.physical_garment_id
    and garment.deleted_at is null
  join public.fitting_sessions as session
    on session.physical_garment_id = garment.id
  where item.id = p_wardrobe_item_id
    and item.deleted_at is null
    and (
      exists (
        select 1 from public.customers c
        where c.id = item.customer_id
          and c.user_id = auth.uid()
          and c.deleted_at is null
      )
      or (
        item.retailer_id = public.current_retailer_id()
        and public.current_retailer_role() in (
          'sales_associate', 'manager', 'admin', 'owner'
        )
      )
      or public.is_platform_staff()
    );
$$;

revoke all on function public.latest_official_fitting_at(uuid) from public;
grant execute on function public.latest_official_fitting_at(uuid)
  to authenticated, service_role;
