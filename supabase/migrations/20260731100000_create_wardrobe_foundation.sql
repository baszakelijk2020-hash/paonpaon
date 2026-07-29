-- PAON Intelligence Platform Stage 4.1.
-- Relationship-scoped wardrobe ownership, append-only history, and metadata
-- target enablement (WARD-001/002/003 / ADR-063).

-- ---------------------------------------------------------------------------
-- wardrobe_items — customer-visible garments inside one retailer relationship
-- ---------------------------------------------------------------------------

create table if not exists public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  ownership_source text not null check (
    ownership_source in ('retailer_purchase', 'external')
  ),
  category_code text not null check (
    category_code in (
      'suit', 'jacket', 'trousers', 'waistcoat', 'shirt', 'overcoat', 'coat',
      'formalwear', 'denim', 'knitwear', 'leather', 'accessories', 'other'
    )
  ),
  title text not null check (length(btrim(title)) between 1 and 200),
  description text check (
    description is null or length(btrim(description)) between 1 and 2000
  ),
  brand text check (
    brand is null or length(btrim(brand)) between 1 and 120
  ),
  photo_url text check (
    photo_url is null or length(photo_url) between 1 and 2048
  ),
  product_id uuid references public.products (id) on delete set null,
  order_line_id uuid references public.order_lines (id) on delete set null,
  physical_garment_id uuid references public.physical_garments (id)
    on delete set null,
  condition_state text not null default 'good' check (
    condition_state in ('excellent', 'good', 'fair', 'worn', 'needs_repair')
  ),
  fit_notes text check (
    fit_notes is null or length(btrim(fit_notes)) between 1 and 2000
  ),
  care_notes text check (
    care_notes is null or length(btrim(care_notes)) between 1 and 2000
  ),
  wear_frequency text check (
    wear_frequency is null
    or wear_frequency in ('rarely', 'sometimes', 'often', 'daily')
  ),
  last_worn_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wardrobe_items_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint wardrobe_items_external_no_catalogue_link check (
    ownership_source <> 'external'
    or (product_id is null and order_line_id is null)
  ),
  constraint wardrobe_items_retailer_purchase_has_link check (
    ownership_source <> 'retailer_purchase'
    or (
      product_id is not null
      or order_line_id is not null
      or physical_garment_id is not null
    )
  )
);

create index if not exists wardrobe_items_customer_active_idx
  on public.wardrobe_items (customer_id, retailer_id)
  where archived_at is null;

create index if not exists wardrobe_items_retailer_customer_idx
  on public.wardrobe_items (retailer_id, customer_id, created_at desc);

comment on table public.wardrobe_items is
  'Customer-visible wardrobe items scoped to one retailer relationship (ADR-063).';

create trigger set_wardrobe_items_updated_at
  before update on public.wardrobe_items
  for each row execute function public.set_updated_at();

alter table public.wardrobe_items enable row level security;

revoke all on table public.wardrobe_items from anon;

create policy "customers read own wardrobe items"
  on public.wardrobe_items for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = wardrobe_items.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant wardrobe items"
  on public.wardrobe_items for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read wardrobe items"
  on public.wardrobe_items for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.wardrobe_items to authenticated, service_role;
grant all on table public.wardrobe_items to service_role;

-- ---------------------------------------------------------------------------
-- wardrobe_ownership_events — append-only ownership and collaboration history
-- ---------------------------------------------------------------------------

create table if not exists public.wardrobe_ownership_events (
  id uuid primary key default gen_random_uuid(),
  wardrobe_item_id uuid not null references public.wardrobe_items (id)
    on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  event_type text not null check (
    event_type in (
      'created', 'state_updated', 'advisor_note', 'archived', 'restored'
    )
  ),
  actor_type text not null check (actor_type in ('customer', 'advisor')),
  actor_staff_id uuid references public.retailer_staff_members (id)
    on delete set null,
  detail jsonb not null default '{}'::jsonb
    check (jsonb_typeof(detail) = 'object'),
  created_at timestamptz not null default now(),
  constraint wardrobe_ownership_events_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint wardrobe_ownership_events_advisor_staff_pair check (
    (actor_type = 'customer' and actor_staff_id is null)
    or (actor_type = 'advisor' and actor_staff_id is not null)
  )
);

create index if not exists wardrobe_ownership_events_item_created_idx
  on public.wardrobe_ownership_events (
    wardrobe_item_id,
    created_at desc
  );

comment on table public.wardrobe_ownership_events is
  'Append-only wardrobe ownership and collaboration history (ADR-063).';

alter table public.wardrobe_ownership_events enable row level security;

revoke all on table public.wardrobe_ownership_events from anon;

create policy "customers read own wardrobe history"
  on public.wardrobe_ownership_events for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = wardrobe_ownership_events.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant wardrobe history"
  on public.wardrobe_ownership_events for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read wardrobe history"
  on public.wardrobe_ownership_events for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.wardrobe_ownership_events
  to authenticated, service_role;
grant all on table public.wardrobe_ownership_events to service_role;

-- ---------------------------------------------------------------------------
-- Enable wardrobe_item metadata targets (Stage 4.1)
-- ---------------------------------------------------------------------------

create or replace function public.enforce_entity_metadata_assignment_tenancy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_concept_retailer_id uuid;
  v_target_retailer_id uuid;
  v_reviewer_retailer_id uuid;
begin
  if tg_op = 'UPDATE'
    and new.deleted_at is not null
    and old.deleted_at is null then
    return new;
  end if;

  select concept.retailer_id into v_concept_retailer_id
  from public.metadata_concepts as concept
  where concept.id = new.concept_id
    and concept.deleted_at is null;
  if not found then
    raise exception 'Metadata concept is unavailable';
  end if;

  if v_concept_retailer_id is not null
    and v_concept_retailer_id <> new.retailer_id then
    raise exception 'Metadata concept does not belong to the retailer';
  end if;

  case new.target_type
    when 'product' then
      select product.retailer_id into v_target_retailer_id
      from public.products as product
      where product.id = new.target_id
        and product.deleted_at is null;
    when 'product_variant' then
      select product.retailer_id into v_target_retailer_id
      from public.product_variants as variant
      join public.products as product on product.id = variant.product_id
      where variant.id = new.target_id
        and variant.deleted_at is null
        and product.deleted_at is null;
    when 'wardrobe_item' then
      select item.retailer_id into v_target_retailer_id
      from public.wardrobe_items as item
      where item.id = new.target_id
        and item.archived_at is null;
  end case;

  if v_target_retailer_id is null
    or v_target_retailer_id <> new.retailer_id then
    raise exception 'Metadata target does not belong to the retailer';
  end if;

  if new.reviewed_by_staff_id is not null then
    select staff.retailer_id into v_reviewer_retailer_id
    from public.retailer_staff_members as staff
    where staff.id = new.reviewed_by_staff_id
      and staff.deleted_at is null;

    if v_reviewer_retailer_id is null
      or v_reviewer_retailer_id <> new.retailer_id then
      raise exception 'Metadata reviewer does not belong to the retailer';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_entity_metadata_assignment_tenancy() from public;

-- ---------------------------------------------------------------------------
-- Customer: add external wardrobe item
-- ---------------------------------------------------------------------------

create or replace function public.create_external_wardrobe_item(
  p_retailer_id uuid,
  p_category_code text,
  p_title text,
  p_description text default null,
  p_brand text default null,
  p_photo_url text default null,
  p_condition_state text default 'good',
  p_fit_notes text default null,
  p_care_notes text default null,
  p_wear_frequency text default null
)
returns public.wardrobe_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_customer public.customers%rowtype;
  v_item public.wardrobe_items%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_customer
  from public.customers c
  where c.user_id = v_uid
    and c.retailer_id = p_retailer_id
    and c.deleted_at is null;
  if not found then
    raise exception 'Customer relationship not found';
  end if;

  insert into public.wardrobe_items (
    retailer_id,
    customer_id,
    ownership_source,
    category_code,
    title,
    description,
    brand,
    photo_url,
    condition_state,
    fit_notes,
    care_notes,
    wear_frequency
  )
  values (
    p_retailer_id,
    v_customer.id,
    'external',
    p_category_code,
    btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''),
    nullif(btrim(coalesce(p_brand, '')), ''),
    nullif(btrim(coalesce(p_photo_url, '')), ''),
    coalesce(p_condition_state, 'good'),
    nullif(btrim(coalesce(p_fit_notes, '')), ''),
    nullif(btrim(coalesce(p_care_notes, '')), ''),
    p_wear_frequency
  )
  returning * into v_item;

  insert into public.wardrobe_ownership_events (
    wardrobe_item_id,
    retailer_id,
    customer_id,
    event_type,
    actor_type,
    detail
  )
  values (
    v_item.id,
    v_item.retailer_id,
    v_item.customer_id,
    'created',
    'customer',
    jsonb_build_object(
      'ownershipSource', 'external',
      'categoryCode', v_item.category_code,
      'title', v_item.title
    )
  );

  return v_item;
end;
$$;

revoke all on function public.create_external_wardrobe_item(
  uuid, text, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.create_external_wardrobe_item(
  uuid, text, text, text, text, text, text, text, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- Retailer staff: link retailer-purchased wardrobe item
-- ---------------------------------------------------------------------------

create or replace function public.create_retailer_purchase_wardrobe_item(
  p_customer_id uuid,
  p_category_code text,
  p_title text,
  p_description text default null,
  p_brand text default null,
  p_photo_url text default null,
  p_product_id uuid default null,
  p_order_line_id uuid default null,
  p_physical_garment_id uuid default null,
  p_condition_state text default 'good',
  p_fit_notes text default null,
  p_care_notes text default null,
  p_wear_frequency text default null
)
returns public.wardrobe_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retailer_id uuid := public.current_retailer_id();
  v_role text := public.current_retailer_role();
  v_staff_id uuid;
  v_customer public.customers%rowtype;
  v_item public.wardrobe_items%rowtype;
  v_link_retailer_id uuid;
begin
  if v_retailer_id is null then
    raise exception 'Not authenticated as retailer staff';
  end if;
  if v_role not in ('sales_associate', 'manager', 'admin', 'owner') then
    raise exception 'Insufficient retailer role';
  end if;

  select staff.id into v_staff_id
  from public.retailer_staff_members staff
  where staff.user_id = auth.uid()
    and staff.retailer_id = v_retailer_id
    and staff.deleted_at is null;
  if v_staff_id is null then
    raise exception 'Retailer staff record not found';
  end if;

  select * into v_customer
  from public.customers c
  where c.id = p_customer_id
    and c.retailer_id = v_retailer_id
    and c.deleted_at is null;
  if not found then
    raise exception 'Customer not found in retailer';
  end if;

  if p_product_id is null
    and p_order_line_id is null
    and p_physical_garment_id is null then
    raise exception 'Retailer purchase wardrobe item requires a catalogue or garment link';
  end if;

  if p_product_id is not null then
    select product.retailer_id into v_link_retailer_id
    from public.products product
    where product.id = p_product_id and product.deleted_at is null;
    if v_link_retailer_id is distinct from v_retailer_id then
      raise exception 'Product does not belong to retailer';
    end if;
  end if;

  if p_order_line_id is not null then
    select o.retailer_id into v_link_retailer_id
    from public.order_lines ol
    join public.orders o on o.id = ol.order_id
    where ol.id = p_order_line_id;
    if v_link_retailer_id is distinct from v_retailer_id then
      raise exception 'Order line does not belong to retailer';
    end if;
  end if;

  if p_physical_garment_id is not null then
    select garment.retailer_id into v_link_retailer_id
    from public.physical_garments garment
    where garment.id = p_physical_garment_id;
    if v_link_retailer_id is distinct from v_retailer_id
      or not exists (
        select 1 from public.physical_garments g
        where g.id = p_physical_garment_id
          and g.customer_id = p_customer_id
      ) then
      raise exception 'Physical garment does not belong to customer relationship';
    end if;
  end if;

  insert into public.wardrobe_items (
    retailer_id,
    customer_id,
    ownership_source,
    category_code,
    title,
    description,
    brand,
    photo_url,
    product_id,
    order_line_id,
    physical_garment_id,
    condition_state,
    fit_notes,
    care_notes,
    wear_frequency
  )
  values (
    v_retailer_id,
    p_customer_id,
    'retailer_purchase',
    p_category_code,
    btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''),
    nullif(btrim(coalesce(p_brand, '')), ''),
    nullif(btrim(coalesce(p_photo_url, '')), ''),
    p_product_id,
    p_order_line_id,
    p_physical_garment_id,
    coalesce(p_condition_state, 'good'),
    nullif(btrim(coalesce(p_fit_notes, '')), ''),
    nullif(btrim(coalesce(p_care_notes, '')), ''),
    p_wear_frequency
  )
  returning * into v_item;

  insert into public.wardrobe_ownership_events (
    wardrobe_item_id,
    retailer_id,
    customer_id,
    event_type,
    actor_type,
    actor_staff_id,
    detail
  )
  values (
    v_item.id,
    v_item.retailer_id,
    v_item.customer_id,
    'created',
    'advisor',
    v_staff_id,
    jsonb_build_object(
      'ownershipSource', 'retailer_purchase',
      'categoryCode', v_item.category_code,
      'title', v_item.title
    )
  );

  return v_item;
end;
$$;

revoke all on function public.create_retailer_purchase_wardrobe_item(
  uuid, text, text, text, text, text, uuid, uuid, uuid, text, text, text, text
) from public;
grant execute on function public.create_retailer_purchase_wardrobe_item(
  uuid, text, text, text, text, text, uuid, uuid, uuid, text, text, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- Shared state update (customer own item or retailer staff in tenant)
-- ---------------------------------------------------------------------------

create or replace function public.update_wardrobe_item_state(
  p_wardrobe_item_id uuid,
  p_condition_state text default null,
  p_fit_notes text default null,
  p_care_notes text default null,
  p_wear_frequency text default null,
  p_last_worn_at timestamptz default null
)
returns public.wardrobe_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_retailer_id uuid := public.current_retailer_id();
  v_role text := public.current_retailer_role();
  v_staff_id uuid;
  v_item public.wardrobe_items%rowtype;
  v_actor_type text;
  v_detail jsonb := '{}'::jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_item
  from public.wardrobe_items wi
  where wi.id = p_wardrobe_item_id
    and wi.archived_at is null;
  if not found then
    raise exception 'Wardrobe item not found';
  end if;

  if exists (
    select 1 from public.customers c
    where c.id = v_item.customer_id
      and c.user_id = v_uid
      and c.deleted_at is null
  ) then
    v_actor_type := 'customer';
  elsif v_retailer_id = v_item.retailer_id
    and v_role in ('sales_associate', 'manager', 'admin', 'owner') then
    select staff.id into v_staff_id
    from public.retailer_staff_members staff
    where staff.user_id = v_uid
      and staff.retailer_id = v_retailer_id
      and staff.deleted_at is null;
    if v_staff_id is null then
      raise exception 'Retailer staff record not found';
    end if;
    v_actor_type := 'advisor';
  else
    raise exception 'Not authorized to update wardrobe item';
  end if;

  update public.wardrobe_items wi
  set
    condition_state = coalesce(p_condition_state, wi.condition_state),
    fit_notes = case
      when p_fit_notes is null then wi.fit_notes
      else nullif(btrim(p_fit_notes), '')
    end,
    care_notes = case
      when p_care_notes is null then wi.care_notes
      else nullif(btrim(p_care_notes), '')
    end,
    wear_frequency = coalesce(p_wear_frequency, wi.wear_frequency),
    last_worn_at = coalesce(p_last_worn_at, wi.last_worn_at)
  where wi.id = p_wardrobe_item_id
  returning * into v_item;

  if p_condition_state is not null then
    v_detail := v_detail || jsonb_build_object('conditionState', p_condition_state);
  end if;
  if p_fit_notes is not null then
    v_detail := v_detail || jsonb_build_object('fitNotes', nullif(btrim(p_fit_notes), ''));
  end if;
  if p_care_notes is not null then
    v_detail := v_detail || jsonb_build_object('careNotes', nullif(btrim(p_care_notes), ''));
  end if;
  if p_wear_frequency is not null then
    v_detail := v_detail || jsonb_build_object('wearFrequency', p_wear_frequency);
  end if;
  if p_last_worn_at is not null then
    v_detail := v_detail || jsonb_build_object('lastWornAt', p_last_worn_at);
  end if;

  insert into public.wardrobe_ownership_events (
    wardrobe_item_id,
    retailer_id,
    customer_id,
    event_type,
    actor_type,
    actor_staff_id,
    detail
  )
  values (
    v_item.id,
    v_item.retailer_id,
    v_item.customer_id,
    'state_updated',
    v_actor_type,
    v_staff_id,
    v_detail
  );

  return v_item;
end;
$$;

revoke all on function public.update_wardrobe_item_state(
  uuid, text, text, text, text, timestamptz
) from public;
grant execute on function public.update_wardrobe_item_state(
  uuid, text, text, text, text, timestamptz
) to authenticated;

-- ---------------------------------------------------------------------------
-- Advisor collaboration note
-- ---------------------------------------------------------------------------

create or replace function public.add_wardrobe_advisor_note(
  p_wardrobe_item_id uuid,
  p_note text
)
returns public.wardrobe_ownership_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retailer_id uuid := public.current_retailer_id();
  v_role text := public.current_retailer_role();
  v_staff_id uuid;
  v_item public.wardrobe_items%rowtype;
  v_event public.wardrobe_ownership_events%rowtype;
begin
  if v_retailer_id is null then
    raise exception 'Not authenticated as retailer staff';
  end if;
  if v_role not in ('sales_associate', 'manager', 'admin', 'owner') then
    raise exception 'Insufficient retailer role';
  end if;

  select staff.id into v_staff_id
  from public.retailer_staff_members staff
  where staff.user_id = auth.uid()
    and staff.retailer_id = v_retailer_id
    and staff.deleted_at is null;
  if v_staff_id is null then
    raise exception 'Retailer staff record not found';
  end if;

  select * into v_item
  from public.wardrobe_items wi
  where wi.id = p_wardrobe_item_id
    and wi.retailer_id = v_retailer_id
    and wi.archived_at is null;
  if not found then
    raise exception 'Wardrobe item not found';
  end if;

  insert into public.wardrobe_ownership_events (
    wardrobe_item_id,
    retailer_id,
    customer_id,
    event_type,
    actor_type,
    actor_staff_id,
    detail
  )
  values (
    v_item.id,
    v_item.retailer_id,
    v_item.customer_id,
    'advisor_note',
    'advisor',
    v_staff_id,
    jsonb_build_object('note', btrim(p_note))
  )
  returning * into v_event;

  return v_event;
end;
$$;

revoke all on function public.add_wardrobe_advisor_note(uuid, text) from public;
grant execute on function public.add_wardrobe_advisor_note(uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Customer archive (soft remove from active wardrobe)
-- ---------------------------------------------------------------------------

create or replace function public.archive_wardrobe_item(
  p_wardrobe_item_id uuid
)
returns public.wardrobe_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_item public.wardrobe_items%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_item
  from public.wardrobe_items wi
  where wi.id = p_wardrobe_item_id
    and wi.archived_at is null;
  if not found then
    raise exception 'Wardrobe item not found';
  end if;

  if not exists (
    select 1 from public.customers c
    where c.id = v_item.customer_id
      and c.user_id = v_uid
      and c.deleted_at is null
  ) then
    raise exception 'Not authorized to archive wardrobe item';
  end if;

  update public.wardrobe_items wi
  set archived_at = now()
  where wi.id = p_wardrobe_item_id
  returning * into v_item;

  insert into public.wardrobe_ownership_events (
    wardrobe_item_id,
    retailer_id,
    customer_id,
    event_type,
    actor_type,
    detail
  )
  values (
    v_item.id,
    v_item.retailer_id,
    v_item.customer_id,
    'archived',
    'customer',
    '{}'::jsonb
  );

  return v_item;
end;
$$;

revoke all on function public.archive_wardrobe_item(uuid) from public;
grant execute on function public.archive_wardrobe_item(uuid) to authenticated;
