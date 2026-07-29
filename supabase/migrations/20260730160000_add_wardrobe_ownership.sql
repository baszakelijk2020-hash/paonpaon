-- PAON Intelligence Platform Stage 4.1.
-- Relationship-scoped wardrobe ownership and collaboration (WARD-001–003,
-- ADR-063). PhysicalGarment remains the official fitting/service aggregate.

-- ---------------------------------------------------------------------------
-- wardrobe_items — one owned garment inside a retailer-customer relationship
-- ---------------------------------------------------------------------------

create table if not exists public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  ownership_kind text not null check (
    ownership_kind in ('retailer_purchased', 'external')
  ),
  provenance_source text not null check (
    provenance_source in (
      'order_line',
      'catalogue_link',
      'customer_added',
      'advisor_added'
    )
  ),
  category_code text not null check (
    category_code in (
      'suit',
      'jacket',
      'trousers',
      'waistcoat',
      'shirt',
      'overcoat',
      'coat',
      'formalwear',
      'denim',
      'knitwear',
      'leather',
      'accessories',
      'other'
    )
  ),
  display_name text not null check (
    length(btrim(display_name)) between 1 and 200
  ),
  brand text check (brand is null or length(btrim(brand)) between 1 and 120),
  description text check (
    description is null or length(btrim(description)) between 1 and 2000
  ),
  condition text not null check (
    condition in (
      'new',
      'excellent',
      'good',
      'fair',
      'needs_care',
      'retired'
    )
  ),
  wear_frequency text check (
    wear_frequency is null
    or wear_frequency in (
      'rarely',
      'occasionally',
      'regularly',
      'frequently'
    )
  ),
  care_state text not null default 'current' check (
    care_state in ('current', 'due_soon', 'needs_attention', 'in_service')
  ),
  fit_perception text not null default 'unknown' check (
    fit_perception in (
      'unknown',
      'true_to_size',
      'slightly_tight',
      'slightly_loose',
      'needs_alteration'
    )
  ),
  care_notes text check (
    care_notes is null or length(btrim(care_notes)) between 1 and 2000
  ),
  fit_notes text check (
    fit_notes is null or length(btrim(fit_notes)) between 1 and 2000
  ),
  acquired_at timestamptz,
  product_id uuid references public.products (id) on delete set null,
  order_line_id uuid references public.order_lines (id) on delete set null,
  physical_garment_id uuid references public.physical_garments (id) on delete set null,
  identifying_photo_url text check (
    identifying_photo_url is null
    or length(btrim(identifying_photo_url)) between 1 and 2000
  ),
  created_by_actor text not null check (
    created_by_actor in ('customer', 'advisor')
  ),
  created_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint wardrobe_items_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint wardrobe_items_ownership_provenance_chk check (
    (
      ownership_kind = 'retailer_purchased'
      and provenance_source in ('order_line', 'catalogue_link', 'advisor_added')
    )
    or (
      ownership_kind = 'external'
      and provenance_source in ('customer_added', 'advisor_added')
      and order_line_id is null
    )
  ),
  constraint wardrobe_items_order_line_requires_purchase_chk check (
    order_line_id is null or ownership_kind = 'retailer_purchased'
  ),
  constraint wardrobe_items_order_line_provenance_chk check (
    provenance_source <> 'order_line' or order_line_id is not null
  ),
  constraint wardrobe_items_actor_staff_chk check (
    (
      created_by_actor = 'advisor'
      and created_by_staff_id is not null
    )
    or (
      created_by_actor = 'customer'
      and created_by_staff_id is null
    )
  ),
  constraint wardrobe_items_retired_condition_chk check (
    (
      retired_at is null
      and condition <> 'retired'
    )
    or (
      retired_at is not null
      and condition = 'retired'
    )
  )
);

create index if not exists wardrobe_items_customer_idx
  on public.wardrobe_items (customer_id, created_at desc)
  where deleted_at is null;

create index if not exists wardrobe_items_retailer_customer_idx
  on public.wardrobe_items (retailer_id, customer_id, created_at desc)
  where deleted_at is null;

create index if not exists wardrobe_items_product_idx
  on public.wardrobe_items (product_id)
  where product_id is not null and deleted_at is null;

comment on table public.wardrobe_items is
  'Customer wardrobe ownership inside one retailer relationship (ADR-063). Not PhysicalGarment.';

create trigger set_wardrobe_items_updated_at
  before update on public.wardrobe_items
  for each row execute function public.set_updated_at();

-- Same-tenant optional references
create or replace function public.enforce_wardrobe_item_reference_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_product_retailer_id uuid;
  v_order_retailer_id uuid;
  v_garment_retailer_id uuid;
  v_garment_customer_id uuid;
  v_staff_retailer_id uuid;
begin
  if new.product_id is not null then
    select product.retailer_id into v_product_retailer_id
    from public.products as product
    where product.id = new.product_id
      and product.deleted_at is null;
    if v_product_retailer_id is null
      or v_product_retailer_id <> new.retailer_id then
      raise exception 'Wardrobe product does not belong to the retailer';
    end if;
  end if;

  if new.order_line_id is not null then
    select ord.retailer_id into v_order_retailer_id
    from public.order_lines as line
    join public.orders as ord on ord.id = line.order_id
    where line.id = new.order_line_id
      and ord.deleted_at is null;
    if v_order_retailer_id is null
      or v_order_retailer_id <> new.retailer_id then
      raise exception 'Wardrobe order line does not belong to the retailer';
    end if;
  end if;

  if new.physical_garment_id is not null then
    select garment.retailer_id, garment.customer_id
      into v_garment_retailer_id, v_garment_customer_id
    from public.physical_garments as garment
    where garment.id = new.physical_garment_id
      and garment.deleted_at is null;
    if v_garment_retailer_id is null
      or v_garment_retailer_id <> new.retailer_id
      or v_garment_customer_id <> new.customer_id then
      raise exception 'Wardrobe physical garment does not belong to the relationship';
    end if;
  end if;

  if new.created_by_staff_id is not null then
    select staff.retailer_id into v_staff_retailer_id
    from public.retailer_staff_members as staff
    where staff.id = new.created_by_staff_id
      and staff.deleted_at is null;
    if v_staff_retailer_id is null
      or v_staff_retailer_id <> new.retailer_id then
      raise exception 'Wardrobe creator staff does not belong to the retailer';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_wardrobe_item_reference_tenancy() from public;

create trigger enforce_wardrobe_item_reference_tenancy_on_write
  before insert or update on public.wardrobe_items
  for each row execute function public.enforce_wardrobe_item_reference_tenancy();

create or replace function public.protect_wardrobe_item_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.retailer_id is distinct from old.retailer_id
    or new.customer_id is distinct from old.customer_id
    or new.created_by_actor is distinct from old.created_by_actor
    or new.created_by_staff_id is distinct from old.created_by_staff_id then
    raise exception 'Wardrobe item identity fields are immutable';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_wardrobe_item_identity() from public;

create trigger protect_wardrobe_item_identity_on_update
  before update on public.wardrobe_items
  for each row execute function public.protect_wardrobe_item_identity();

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

create policy "customers insert own wardrobe items"
  on public.wardrobe_items for insert to authenticated
  with check (
    created_by_actor = 'customer'
    and created_by_staff_id is null
    and ownership_kind = 'external'
    and provenance_source = 'customer_added'
    and exists (
      select 1 from public.customers c
      where c.id = wardrobe_items.customer_id
        and c.retailer_id = wardrobe_items.retailer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff insert tenant wardrobe items"
  on public.wardrobe_items for insert to authenticated
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
    and created_by_actor = 'advisor'
    and created_by_staff_id = (select public.current_staff_id())
    and exists (
      select 1 from public.customers c
      where c.id = wardrobe_items.customer_id
        and c.retailer_id = wardrobe_items.retailer_id
        and c.deleted_at is null
    )
  );

create policy "customers update own wardrobe items"
  on public.wardrobe_items for update to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = wardrobe_items.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.customers c
      where c.id = wardrobe_items.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff update tenant wardrobe items"
  on public.wardrobe_items for update to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  )
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

grant select, insert, update on table public.wardrobe_items
  to authenticated, service_role;
grant all on table public.wardrobe_items to service_role;

-- ---------------------------------------------------------------------------
-- wardrobe_ownership_events — append-only ownership/provenance history
-- ---------------------------------------------------------------------------

create table if not exists public.wardrobe_ownership_events (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  wardrobe_item_id uuid not null references public.wardrobe_items (id) on delete cascade,
  event_kind text not null check (
    event_kind in (
      'acquired',
      'ownership_confirmed',
      'provenance_updated',
      'retired',
      'restored'
    )
  ),
  ownership_kind text not null check (
    ownership_kind in ('retailer_purchased', 'external')
  ),
  provenance_source text not null check (
    provenance_source in (
      'order_line',
      'catalogue_link',
      'customer_added',
      'advisor_added'
    )
  ),
  actor_kind text not null check (
    actor_kind in ('customer', 'advisor', 'system')
  ),
  actor_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  note text check (note is null or length(btrim(note)) between 1 and 500),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint wardrobe_ownership_events_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate
);

create index if not exists wardrobe_ownership_events_item_idx
  on public.wardrobe_ownership_events (wardrobe_item_id, occurred_at desc);

create index if not exists wardrobe_ownership_events_customer_idx
  on public.wardrobe_ownership_events (customer_id, occurred_at desc);

comment on table public.wardrobe_ownership_events is
  'Append-only wardrobe ownership/provenance history (ADR-063).';

alter table public.wardrobe_ownership_events enable row level security;

revoke all on table public.wardrobe_ownership_events from anon;

create policy "customers read own wardrobe ownership events"
  on public.wardrobe_ownership_events for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = wardrobe_ownership_events.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant wardrobe ownership events"
  on public.wardrobe_ownership_events for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read wardrobe ownership events"
  on public.wardrobe_ownership_events for select to authenticated
  using ((select public.is_platform_staff()));

-- No authenticated writes — trigger owns append-only history.
grant select on table public.wardrobe_ownership_events
  to authenticated, service_role;
grant all on table public.wardrobe_ownership_events to service_role;

create or replace function public.record_wardrobe_ownership_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_kind text;
  v_actor_kind text;
  v_note text := null;
begin
  if tg_op = 'INSERT' then
    insert into public.wardrobe_ownership_events (
      retailer_id,
      customer_id,
      wardrobe_item_id,
      event_kind,
      ownership_kind,
      provenance_source,
      actor_kind,
      actor_staff_id,
      note,
      occurred_at
    ) values (
      new.retailer_id,
      new.customer_id,
      new.id,
      'acquired',
      new.ownership_kind,
      new.provenance_source,
      new.created_by_actor,
      new.created_by_staff_id,
      null,
      coalesce(new.acquired_at, new.created_at, now())
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.ownership_kind is distinct from old.ownership_kind
      or new.provenance_source is distinct from old.provenance_source then
      v_event_kind := 'provenance_updated';
    elsif old.retired_at is null and new.retired_at is not null then
      v_event_kind := 'retired';
    elsif old.retired_at is not null and new.retired_at is null then
      v_event_kind := 'restored';
    else
      return new;
    end if;

    if new.created_by_staff_id is not null
      and (select public.current_staff_id()) is not null then
      v_actor_kind := 'advisor';
    elsif exists (
      select 1 from public.customers c
      where c.id = new.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    ) then
      v_actor_kind := 'customer';
    else
      v_actor_kind := 'system';
    end if;

    insert into public.wardrobe_ownership_events (
      retailer_id,
      customer_id,
      wardrobe_item_id,
      event_kind,
      ownership_kind,
      provenance_source,
      actor_kind,
      actor_staff_id,
      note,
      occurred_at
    ) values (
      new.retailer_id,
      new.customer_id,
      new.id,
      v_event_kind,
      new.ownership_kind,
      new.provenance_source,
      v_actor_kind,
      case
        when v_actor_kind = 'advisor' then (select public.current_staff_id())
        else null
      end,
      v_note,
      now()
    );
  end if;

  return new;
end;
$$;

revoke all on function public.record_wardrobe_ownership_event() from public;

create trigger record_wardrobe_ownership_event_on_write
  after insert or update on public.wardrobe_items
  for each row execute function public.record_wardrobe_ownership_event();

-- ---------------------------------------------------------------------------
-- Enable wardrobe_item metadata assignment targets (ADR-059 / ADR-063)
-- ---------------------------------------------------------------------------

create or replace function public.enforce_entity_metadata_assignment_tenancy()
returns trigger
language plpgsql
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
        and item.deleted_at is null;
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
