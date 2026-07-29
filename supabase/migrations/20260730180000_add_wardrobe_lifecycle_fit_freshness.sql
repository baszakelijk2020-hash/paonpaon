-- PAON Intelligence Platform Stage 4.3.
-- Wardrobe lifecycle/history, private self-scan attachments, fit freshness
-- projection inputs, and appointment/alteration handoff (WARD-002, FIT-001–
-- FIT-003, LONG-001; ADR-016, ADR-055, ADR-063).
-- Self-reported scans never write fitting_observations.

-- ---------------------------------------------------------------------------
-- wardrobe_lifecycle_events — append-only wear/rest/care/repair history
-- ---------------------------------------------------------------------------

create table if not exists public.wardrobe_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  wardrobe_item_id uuid not null references public.wardrobe_items (id) on delete cascade,
  event_kind text not null check (
    event_kind in (
      'worn',
      'rested',
      'cleaned',
      'repaired',
      'care_logged',
      'guidance_dismissed'
    )
  ),
  actor_kind text not null check (
    actor_kind in ('customer', 'advisor', 'system')
  ),
  actor_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  note text check (note is null or length(btrim(note)) between 1 and 2000),
  guidance_kind text check (
    guidance_kind is null
    or guidance_kind in (
      'rotate_rest',
      'care_due',
      'cleaning_suggested',
      'repair_suggested',
      'age_stewardship'
    )
  ),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint wardrobe_lifecycle_events_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint wardrobe_lifecycle_events_guidance_chk check (
    (
      event_kind = 'guidance_dismissed'
      and guidance_kind is not null
    )
    or (
      event_kind <> 'guidance_dismissed'
      and guidance_kind is null
    )
  ),
  constraint wardrobe_lifecycle_events_actor_staff_chk check (
    (
      actor_kind = 'advisor'
      and actor_staff_id is not null
    )
    or (
      actor_kind in ('customer', 'system')
      and actor_staff_id is null
    )
  )
);

create index if not exists wardrobe_lifecycle_events_item_idx
  on public.wardrobe_lifecycle_events (wardrobe_item_id, occurred_at desc);

create index if not exists wardrobe_lifecycle_events_customer_idx
  on public.wardrobe_lifecycle_events (customer_id, occurred_at desc);

comment on table public.wardrobe_lifecycle_events is
  'Append-only wardrobe wear/rest/care/repair/guidance history (PHASE 4.3). Not official fitting observations.';

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
-- wardrobe_self_scans — customer photo/notes; provenance always self_reported
-- ---------------------------------------------------------------------------

create table if not exists public.wardrobe_self_scans (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  wardrobe_item_id uuid not null references public.wardrobe_items (id) on delete cascade,
  notes text check (notes is null or length(btrim(notes)) between 1 and 2000),
  size_change_reported boolean not null default false,
  fit_perception_at_scan text check (
    fit_perception_at_scan is null
    or fit_perception_at_scan in (
      'unknown',
      'true_to_size',
      'slightly_tight',
      'slightly_loose',
      'needs_alteration'
    )
  ),
  provenance text not null default 'self_reported' check (
    provenance = 'self_reported'
  ),
  service_handoff_kind text not null default 'none' check (
    service_handoff_kind in (
      'none',
      'fit_update_appointment',
      'alteration_fitting'
    )
  ),
  appointment_id uuid references public.appointments (id) on delete set null,
  appointment_type text check (
    appointment_type is null
    or appointment_type in ('fitting', 'alteration_fitting')
  ),
  created_by_actor text not null check (
    created_by_actor in ('customer', 'advisor')
  ),
  created_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint wardrobe_self_scans_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint wardrobe_self_scans_actor_staff_chk check (
    (
      created_by_actor = 'advisor'
      and created_by_staff_id is not null
    )
    or (
      created_by_actor = 'customer'
      and created_by_staff_id is null
    )
  ),
  constraint wardrobe_self_scans_appointment_type_chk check (
    (
      appointment_id is null
      and appointment_type is null
    )
    or (
      appointment_id is not null
      and appointment_type is not null
    )
  )
);

create index if not exists wardrobe_self_scans_item_idx
  on public.wardrobe_self_scans (wardrobe_item_id, created_at desc);

create index if not exists wardrobe_self_scans_customer_idx
  on public.wardrobe_self_scans (customer_id, created_at desc);

comment on table public.wardrobe_self_scans is
  'Self-reported wear photos/notes. Provenance is always self_reported; never populates fitting_observations (ADR-016/055/063).';

alter table public.wardrobe_self_scans enable row level security;

revoke all on table public.wardrobe_self_scans from anon;

create policy "customers read own wardrobe self scans"
  on public.wardrobe_self_scans for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = wardrobe_self_scans.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant wardrobe self scans"
  on public.wardrobe_self_scans for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read wardrobe self scans"
  on public.wardrobe_self_scans for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.wardrobe_self_scans
  to authenticated, service_role;
grant all on table public.wardrobe_self_scans to service_role;

-- ---------------------------------------------------------------------------
-- wardrobe_attachments — private self-scan / identifying evidence metadata
-- ---------------------------------------------------------------------------

create table if not exists public.wardrobe_attachments (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  wardrobe_item_id uuid not null references public.wardrobe_items (id) on delete cascade,
  self_scan_id uuid references public.wardrobe_self_scans (id) on delete cascade,
  kind text not null check (kind in ('self_scan', 'identifying')),
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null check (length(btrim(file_name)) between 1 and 255),
  mime_type text not null check (
    mime_type in ('image/jpeg', 'image/png', 'image/webp')
  ),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by_actor text not null check (
    uploaded_by_actor in ('customer', 'advisor')
  ),
  uploaded_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path),
  constraint wardrobe_attachments_actor_staff_chk check (
    (
      uploaded_by_actor = 'advisor'
      and uploaded_by_staff_id is not null
    )
    or (
      uploaded_by_actor = 'customer'
      and uploaded_by_staff_id is null
    )
  )
);

create index if not exists wardrobe_attachments_item_idx
  on public.wardrobe_attachments (wardrobe_item_id, created_at desc);

create index if not exists wardrobe_attachments_self_scan_idx
  on public.wardrobe_attachments (self_scan_id)
  where self_scan_id is not null;

comment on table public.wardrobe_attachments is
  'Private wardrobe evidence metadata for self-scan/identifying photos. Public URLs are forbidden.';

alter table public.wardrobe_attachments enable row level security;

revoke all on table public.wardrobe_attachments from anon;

create policy "customers read own wardrobe attachments"
  on public.wardrobe_attachments for select to authenticated
  using (
    exists (
      select 1
      from public.wardrobe_items wi
      join public.customers c on c.id = wi.customer_id
      where wi.id = wardrobe_attachments.wardrobe_item_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
        and wi.deleted_at is null
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

-- Path/scope enforcement for attachment metadata
create or replace function public.enforce_wardrobe_attachment_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_item public.wardrobe_items%rowtype;
  v_scan public.wardrobe_self_scans%rowtype;
  v_prefix text;
begin
  if new.storage_bucket <> 'wardrobe-evidence' then
    raise exception 'Wardrobe attachments must use the wardrobe-evidence bucket';
  end if;

  select * into v_item
  from public.wardrobe_items
  where id = new.wardrobe_item_id
    and deleted_at is null;
  if not found then
    raise exception 'Wardrobe item not found for attachment';
  end if;
  if v_item.retailer_id <> new.retailer_id then
    raise exception 'Wardrobe attachment retailer does not match item';
  end if;

  v_prefix := new.retailer_id::text || '/' || new.wardrobe_item_id::text || '/';
  if left(new.storage_path, length(v_prefix)) <> v_prefix then
    raise exception 'Wardrobe attachment path must be retailerId/wardrobeItemId/…';
  end if;
  if position('..' in new.storage_path) > 0 then
    raise exception 'Wardrobe attachment path must not contain traversal';
  end if;

  if new.self_scan_id is not null then
    select * into v_scan
    from public.wardrobe_self_scans
    where id = new.self_scan_id;
    if not found then
      raise exception 'Self-scan not found for attachment';
    end if;
    if v_scan.wardrobe_item_id <> new.wardrobe_item_id
      or v_scan.retailer_id <> new.retailer_id then
      raise exception 'Self-scan does not belong to attachment wardrobe item';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_wardrobe_attachment_scope() from public;

create trigger enforce_wardrobe_attachment_scope_on_write
  before insert or update on public.wardrobe_attachments
  for each row execute function public.enforce_wardrobe_attachment_scope();

-- ---------------------------------------------------------------------------
-- Helpers: eligibility and relationship access
-- ---------------------------------------------------------------------------

create or replace function public.wardrobe_item_self_scan_eligible(
  p_item public.wardrobe_items
) returns boolean
language sql
stable
as $$
  select
    p_item.deleted_at is null
    and p_item.condition <> 'retired'
    and (
      p_item.order_line_id is not null
      or p_item.physical_garment_id is not null
      or p_item.ownership_kind = 'retailer_purchased'
    );
$$;

revoke all on function public.wardrobe_item_self_scan_eligible(public.wardrobe_items)
  from public;

-- ---------------------------------------------------------------------------
-- RPC: record_wardrobe_lifecycle_event (append-only)
-- ---------------------------------------------------------------------------

create or replace function public.record_wardrobe_lifecycle_event(
  p_wardrobe_item_id uuid,
  p_event_kind text,
  p_note text default null,
  p_guidance_kind text default null,
  p_occurred_at timestamptz default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.wardrobe_items%rowtype;
  v_customer public.customers%rowtype;
  v_staff public.retailer_staff_members%rowtype;
  v_actor_kind text;
  v_actor_staff_id uuid;
  v_event_id uuid;
begin
  select * into v_item
  from public.wardrobe_items
  where id = p_wardrobe_item_id
    and deleted_at is null;
  if not found then
    raise exception 'Wardrobe item not found';
  end if;

  select * into v_customer
  from public.customers
  where id = v_item.customer_id
    and deleted_at is null;

  select * into v_staff
  from public.retailer_staff_members
  where retailer_id = v_item.retailer_id
    and user_id = (select auth.uid())
    and accepted_at is not null
    and deleted_at is null;

  if v_customer.user_id = (select auth.uid()) then
    v_actor_kind := 'customer';
    v_actor_staff_id := null;
  elsif v_staff.id is not null
    and v_staff.role in ('sales_associate', 'manager', 'admin', 'owner') then
    v_actor_kind := 'advisor';
    v_actor_staff_id := v_staff.id;
  else
    raise exception 'Not authorized to record wardrobe lifecycle event';
  end if;

  if p_event_kind = 'guidance_dismissed' and p_guidance_kind is null then
    raise exception 'Dismissed guidance requires a guidance kind';
  end if;
  if p_event_kind <> 'guidance_dismissed' and p_guidance_kind is not null then
    raise exception 'Guidance kind is only valid when dismissing guidance';
  end if;

  insert into public.wardrobe_lifecycle_events (
    retailer_id,
    customer_id,
    wardrobe_item_id,
    event_kind,
    actor_kind,
    actor_staff_id,
    note,
    guidance_kind,
    occurred_at
  ) values (
    v_item.retailer_id,
    v_item.customer_id,
    v_item.id,
    p_event_kind,
    v_actor_kind,
    v_actor_staff_id,
    nullif(btrim(coalesce(p_note, '')), ''),
    p_guidance_kind,
    coalesce(p_occurred_at, now())
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.record_wardrobe_lifecycle_event(
  uuid, text, text, text, timestamptz
) from public;
grant execute on function public.record_wardrobe_lifecycle_event(
  uuid, text, text, text, timestamptz
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: submit_wardrobe_self_scan (+ optional appointment handoff)
-- Never inserts into fitting_observations.
-- ---------------------------------------------------------------------------

create or replace function public.submit_wardrobe_self_scan(
  p_wardrobe_item_id uuid,
  p_notes text default null,
  p_size_change_reported boolean default false,
  p_fit_perception_at_scan text default null,
  p_request_service_handoff boolean default true,
  p_appointment_starts_at timestamptz default null,
  p_appointment_ends_at timestamptz default null,
  p_preferred_appointment_type text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.wardrobe_items%rowtype;
  v_customer public.customers%rowtype;
  v_staff public.retailer_staff_members%rowtype;
  v_actor_kind text;
  v_actor_staff_id uuid;
  v_scan_id uuid;
  v_handoff text := 'none';
  v_appointment_type text;
  v_appointment_id uuid;
  v_advisor_notes text;
  v_last_measured timestamptz;
  v_days integer;
  v_freshness text := 'unknown';
begin
  select * into v_item
  from public.wardrobe_items
  where id = p_wardrobe_item_id
    and deleted_at is null;
  if not found then
    raise exception 'Wardrobe item not found';
  end if;

  if not public.wardrobe_item_self_scan_eligible(v_item) then
    raise exception 'Wardrobe item is not eligible for self-scan';
  end if;

  select * into v_customer
  from public.customers
  where id = v_item.customer_id
    and deleted_at is null;

  select * into v_staff
  from public.retailer_staff_members
  where retailer_id = v_item.retailer_id
    and user_id = (select auth.uid())
    and accepted_at is not null
    and deleted_at is null;

  if v_customer.user_id = (select auth.uid()) then
    v_actor_kind := 'customer';
    v_actor_staff_id := null;
  elsif v_staff.id is not null
    and v_staff.role in ('sales_associate', 'manager', 'admin', 'owner') then
    v_actor_kind := 'advisor';
    v_actor_staff_id := v_staff.id;
  else
    raise exception 'Not authorized to submit wardrobe self-scan';
  end if;

  if v_item.physical_garment_id is not null then
    select max(fo.created_at) into v_last_measured
    from public.fitting_observations fo
    where fo.physical_garment_id = v_item.physical_garment_id;
  end if;

  if v_last_measured is null then
    v_freshness := 'unknown';
  else
    v_days := floor(extract(epoch from (now() - v_last_measured)) / 86400)::integer;
    if v_days <= 180 then
      v_freshness := 'current';
    elsif v_days <= 365 then
      v_freshness := 'aging';
    elsif v_days <= 730 then
      v_freshness := 'stale';
    else
      v_freshness := 'overdue';
    end if;
  end if;

  if p_request_service_handoff then
    if coalesce(p_size_change_reported, false)
      or coalesce(p_fit_perception_at_scan, '') in (
        'needs_alteration', 'slightly_tight', 'slightly_loose'
      ) then
      v_handoff := 'alteration_fitting';
      v_appointment_type := coalesce(p_preferred_appointment_type, 'alteration_fitting');
    elsif v_freshness in ('aging', 'stale', 'overdue', 'unknown')
      or nullif(btrim(coalesce(p_notes, '')), '') is not null then
      v_handoff := 'fit_update_appointment';
      v_appointment_type := coalesce(p_preferred_appointment_type, 'fitting');
    end if;

    if v_appointment_type is not null
      and v_appointment_type not in ('fitting', 'alteration_fitting') then
      raise exception 'Self-scan appointment type must be fitting or alteration_fitting';
    end if;
  end if;

  if v_handoff <> 'none'
    and p_appointment_starts_at is not null
    and p_appointment_ends_at is not null then
    if p_appointment_ends_at <= p_appointment_starts_at then
      raise exception 'Appointment end must be after start';
    end if;

    v_advisor_notes := concat_ws(
      E'\n',
      'Self-reported wardrobe self-scan (not an official fitting observation).',
      'Wardrobe item: ' || v_item.display_name || ' (' || v_item.id::text || ')',
      case when nullif(btrim(coalesce(p_notes, '')), '') is not null
        then 'Notes: ' || btrim(p_notes) end,
      case when coalesce(p_size_change_reported, false)
        then 'Customer reported a potential size change.' end,
      case when p_fit_perception_at_scan is not null
        then 'Perceived fit: ' || p_fit_perception_at_scan end,
      'Official fit freshness: ' || v_freshness
    );

    insert into public.appointments (
      retailer_id,
      customer_id,
      type,
      status,
      starts_at,
      ends_at,
      notes
    ) values (
      v_item.retailer_id,
      v_item.customer_id,
      v_appointment_type::public.appointment_type,
      'requested'::public.appointment_status,
      p_appointment_starts_at,
      p_appointment_ends_at,
      v_advisor_notes
    )
    returning id into v_appointment_id;
  end if;

  insert into public.wardrobe_self_scans (
    retailer_id,
    customer_id,
    wardrobe_item_id,
    notes,
    size_change_reported,
    fit_perception_at_scan,
    provenance,
    service_handoff_kind,
    appointment_id,
    appointment_type,
    created_by_actor,
    created_by_staff_id
  ) values (
    v_item.retailer_id,
    v_item.customer_id,
    v_item.id,
    nullif(btrim(coalesce(p_notes, '')), ''),
    coalesce(p_size_change_reported, false),
    p_fit_perception_at_scan,
    'self_reported',
    v_handoff,
    v_appointment_id,
    case when v_appointment_id is not null then v_appointment_type else null end,
    v_actor_kind,
    v_actor_staff_id
  )
  returning id into v_scan_id;

  -- Explicit non-goal guard: this function must never touch fitting_observations.
  -- (Provenance column is constrained to self_reported.)

  return v_scan_id;
end;
$$;

revoke all on function public.submit_wardrobe_self_scan(
  uuid, text, boolean, text, boolean, timestamptz, timestamptz, text
) from public;
grant execute on function public.submit_wardrobe_self_scan(
  uuid, text, boolean, text, boolean, timestamptz, timestamptz, text
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: record_wardrobe_attachment (metadata after private storage upload)
-- ---------------------------------------------------------------------------

create or replace function public.record_wardrobe_attachment(
  p_wardrobe_item_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_kind text default 'self_scan',
  p_self_scan_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.wardrobe_items%rowtype;
  v_customer public.customers%rowtype;
  v_staff public.retailer_staff_members%rowtype;
  v_actor_kind text;
  v_actor_staff_id uuid;
  v_attachment_id uuid;
  v_prefix text;
begin
  select * into v_item
  from public.wardrobe_items
  where id = p_wardrobe_item_id
    and deleted_at is null;
  if not found then
    raise exception 'Wardrobe item not found';
  end if;

  select * into v_customer
  from public.customers
  where id = v_item.customer_id
    and deleted_at is null;

  select * into v_staff
  from public.retailer_staff_members
  where retailer_id = v_item.retailer_id
    and user_id = (select auth.uid())
    and accepted_at is not null
    and deleted_at is null;

  if v_customer.user_id = (select auth.uid()) then
    v_actor_kind := 'customer';
    v_actor_staff_id := null;
  elsif v_staff.id is not null
    and v_staff.role in ('sales_associate', 'manager', 'admin', 'owner') then
    v_actor_kind := 'advisor';
    v_actor_staff_id := v_staff.id;
  else
    raise exception 'Not authorized to record wardrobe attachment';
  end if;

  v_prefix := v_item.retailer_id::text || '/' || v_item.id::text || '/';
  if left(p_storage_path, length(v_prefix)) <> v_prefix then
    raise exception 'Wardrobe attachment path must be retailerId/wardrobeItemId/…';
  end if;
  if position('..' in p_storage_path) > 0 then
    raise exception 'Wardrobe attachment path must not contain traversal';
  end if;

  insert into public.wardrobe_attachments (
    retailer_id,
    wardrobe_item_id,
    self_scan_id,
    kind,
    storage_bucket,
    storage_path,
    file_name,
    mime_type,
    size_bytes,
    uploaded_by_actor,
    uploaded_by_staff_id
  ) values (
    v_item.retailer_id,
    v_item.id,
    p_self_scan_id,
    coalesce(p_kind, 'self_scan'),
    'wardrobe-evidence',
    p_storage_path,
    p_file_name,
    p_mime_type,
    p_size_bytes,
    v_actor_kind,
    v_actor_staff_id
  )
  returning id into v_attachment_id;

  return v_attachment_id;
end;
$$;

revoke all on function public.record_wardrobe_attachment(
  uuid, text, text, text, bigint, text, uuid
) from public;
grant execute on function public.record_wardrobe_attachment(
  uuid, text, text, text, bigint, text, uuid
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Private storage bucket wardrobe-evidence
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wardrobe-evidence',
  'wardrobe-evidence',
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
  v_wardrobe_item_id uuid;
  v_item public.wardrobe_items%rowtype;
begin
  if public.is_platform_staff() then
    return true;
  end if;
  if array_length(v_folders, 1) < 2 then
    return false;
  end if;

  begin
    v_retailer_id := v_folders[1]::uuid;
    v_wardrobe_item_id := v_folders[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  select * into v_item
  from public.wardrobe_items
  where id = v_wardrobe_item_id
    and deleted_at is null;
  if not found or v_item.retailer_id <> v_retailer_id then
    return false;
  end if;

  if exists (
    select 1 from public.customers c
    where c.id = v_item.customer_id
      and c.user_id = (select auth.uid())
      and c.deleted_at is null
  ) then
    return true;
  end if;

  return
    public.current_retailer_id() = v_retailer_id
    and public.current_retailer_role() in (
      'sales_associate', 'manager', 'admin', 'owner'
    );
end;
$$;

revoke all on function public.can_access_wardrobe_storage_object(text) from public;
grant execute on function public.can_access_wardrobe_storage_object(text)
  to authenticated, service_role;

create policy "authorized wardrobe actors can read evidence objects"
  on storage.objects for select
  using (
    bucket_id = 'wardrobe-evidence'
    and public.can_access_wardrobe_storage_object(name)
  );

create policy "authorized wardrobe actors can upload evidence objects"
  on storage.objects for insert
  with check (
    bucket_id = 'wardrobe-evidence'
    and public.can_access_wardrobe_storage_object(name)
  );

create policy "uploaders can remove unregistered wardrobe evidence objects"
  on storage.objects for delete
  using (
    bucket_id = 'wardrobe-evidence'
    and public.can_access_wardrobe_storage_object(name)
    and not exists (
      select 1 from public.wardrobe_attachments a
      where a.storage_bucket = bucket_id
        and a.storage_path = name
    )
  );
