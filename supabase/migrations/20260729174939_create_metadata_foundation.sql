-- PAON Intelligence Platform Stage 1.2.
-- Canonical concepts are platform-owned (retailer_id is null); retailer
-- concepts, edges, assignments and overrides remain tenant-bound. Every
-- exposed table enables RLS and receives explicit Data API grants because
-- current Supabase projects no longer guarantee automatic exposure.

create type public.metadata_concept_kind as enum (
  'mill',
  'fabric_collection',
  'fibre',
  'weave',
  'weight_band',
  'pattern',
  'colour',
  'season',
  'garment_type',
  'construction',
  'fit',
  'formality',
  'climate',
  'performance',
  'care',
  'style',
  'occasion',
  'compatibility',
  'collar',
  'silhouette'
);

create type public.metadata_source as enum (
  'supplier',
  'ai',
  'retailer',
  'paon'
);

create type public.metadata_review_status as enum (
  'pending',
  'accepted',
  'rejected'
);

create type public.metadata_edge_kind as enum (
  'parent',
  'related',
  'equivalent',
  'suggests',
  'compatible_with',
  'incompatible_with'
);

create type public.metadata_target_type as enum (
  'product',
  'product_variant',
  'wardrobe_item'
);

create table public.metadata_concepts (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid references public.retailers (id) on delete cascade,
  kind public.metadata_concept_kind not null,
  slug text not null check (
    length(slug) between 1 and 120
    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  canonical_name text not null check (length(btrim(canonical_name)) between 1 and 200),
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index metadata_concepts_canonical_kind_slug_uidx
  on public.metadata_concepts (kind, slug)
  where retailer_id is null;

create unique index metadata_concepts_retailer_kind_slug_uidx
  on public.metadata_concepts (retailer_id, kind, slug)
  where retailer_id is not null;

create index metadata_concepts_retailer_kind_active_idx
  on public.metadata_concepts (retailer_id, kind, active)
  where deleted_at is null;

create index metadata_concepts_canonical_kind_active_idx
  on public.metadata_concepts (kind, active)
  where retailer_id is null and deleted_at is null;

create trigger set_metadata_concepts_updated_at
  before update on public.metadata_concepts
  for each row execute function public.set_updated_at();

create table public.metadata_concept_edges (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid references public.retailers (id) on delete cascade,
  source_concept_id uuid not null references public.metadata_concepts (id) on delete restrict,
  target_concept_id uuid not null references public.metadata_concepts (id) on delete restrict,
  kind public.metadata_edge_kind not null,
  weight numeric not null default 1 check (
    weight between 0 and 1
    and scale(weight) <= 4
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (source_concept_id <> target_concept_id)
);

create unique index metadata_concept_edges_canonical_uidx
  on public.metadata_concept_edges (source_concept_id, target_concept_id, kind)
  where retailer_id is null and deleted_at is null;

create unique index metadata_concept_edges_retailer_uidx
  on public.metadata_concept_edges (
    retailer_id,
    source_concept_id,
    target_concept_id,
    kind
  )
  where retailer_id is not null and deleted_at is null;

create index metadata_concept_edges_retailer_source_idx
  on public.metadata_concept_edges (retailer_id, source_concept_id)
  where deleted_at is null;

create index metadata_concept_edges_retailer_target_idx
  on public.metadata_concept_edges (retailer_id, target_concept_id)
  where deleted_at is null;

create trigger set_metadata_concept_edges_updated_at
  before update on public.metadata_concept_edges
  for each row execute function public.set_updated_at();

create or replace function public.enforce_metadata_concept_edge_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_source_retailer_id uuid;
  v_target_retailer_id uuid;
begin
  if tg_op = 'UPDATE'
    and new.deleted_at is not null
    and old.deleted_at is null then
    return new;
  end if;

  select concept.retailer_id into v_source_retailer_id
  from public.metadata_concepts as concept
  where concept.id = new.source_concept_id
    and concept.deleted_at is null;
  if not found then
    raise exception 'Source metadata concept is unavailable';
  end if;

  select concept.retailer_id into v_target_retailer_id
  from public.metadata_concepts as concept
  where concept.id = new.target_concept_id
    and concept.deleted_at is null;
  if not found then
    raise exception 'Target metadata concept is unavailable';
  end if;

  if new.retailer_id is null then
    if v_source_retailer_id is not null or v_target_retailer_id is not null then
      raise exception 'Canonical edges may reference canonical concepts only';
    end if;
  elsif (
    (v_source_retailer_id is not null and v_source_retailer_id <> new.retailer_id)
    or (v_target_retailer_id is not null and v_target_retailer_id <> new.retailer_id)
  ) then
    raise exception 'Metadata edge concepts do not belong to the retailer';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_metadata_concept_edge_tenancy() from public;

create trigger enforce_metadata_concept_edge_tenancy_on_write
  before insert or update on public.metadata_concept_edges
  for each row execute function public.enforce_metadata_concept_edge_tenancy();

create table public.entity_metadata_assignments (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  target_type public.metadata_target_type not null,
  target_id uuid not null,
  concept_id uuid not null references public.metadata_concepts (id) on delete restrict,
  source public.metadata_source not null,
  confidence numeric check (
    confidence between 0 and 1
    and scale(confidence) <= 4
  ),
  review_status public.metadata_review_status not null default 'pending',
  supplier_value text check (
    supplier_value is null
    or length(btrim(supplier_value)) between 1 and 1000
  ),
  evidence jsonb check (
    evidence is null
    or jsonb_typeof(evidence) = 'object'
  ),
  reviewed_by_staff_id uuid references public.retailer_staff_members (id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (
    source <> 'ai'
    or (confidence is not null and evidence is not null)
  ),
  check (
    source <> 'supplier'
    or supplier_value is not null
  ),
  check (
    (
      review_status = 'pending'
      and reviewed_by_staff_id is null
      and reviewed_at is null
    )
    or (
      review_status in ('accepted', 'rejected')
      and reviewed_by_staff_id is not null
      and reviewed_at is not null
    )
  )
);

create unique index entity_metadata_assignments_active_uidx
  on public.entity_metadata_assignments (
    retailer_id,
    target_type,
    target_id,
    concept_id
  )
  where deleted_at is null;

create index entity_metadata_assignments_target_idx
  on public.entity_metadata_assignments (
    retailer_id,
    target_type,
    target_id,
    review_status
  )
  where deleted_at is null;

create index entity_metadata_assignments_concept_idx
  on public.entity_metadata_assignments (
    retailer_id,
    concept_id,
    review_status
  )
  where deleted_at is null;

create index entity_metadata_assignments_accepted_idx
  on public.entity_metadata_assignments (retailer_id, concept_id, target_type, target_id)
  where review_status = 'accepted' and deleted_at is null;

create trigger set_entity_metadata_assignments_updated_at
  before update on public.entity_metadata_assignments
  for each row execute function public.set_updated_at();

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
      raise exception 'Wardrobe metadata targets are not available before Stage 4.1';
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

create trigger enforce_entity_metadata_assignment_tenancy_on_write
  before insert or update on public.entity_metadata_assignments
  for each row execute function public.enforce_entity_metadata_assignment_tenancy();

create table public.metadata_assignment_reviews (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  assignment_id uuid not null references public.entity_metadata_assignments (id) on delete restrict,
  previous_status public.metadata_review_status,
  review_status public.metadata_review_status not null check (review_status <> 'pending'),
  reviewed_by_staff_id uuid not null references public.retailer_staff_members (id) on delete restrict,
  source public.metadata_source not null,
  confidence numeric,
  supplier_value text,
  evidence jsonb,
  created_at timestamptz not null default now()
);

create index metadata_assignment_reviews_assignment_created_idx
  on public.metadata_assignment_reviews (assignment_id, created_at desc);

create index metadata_assignment_reviews_retailer_created_idx
  on public.metadata_assignment_reviews (retailer_id, created_at desc);

create or replace function public.record_metadata_assignment_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.review_status <> 'pending'
    and (
      tg_op = 'INSERT'
      or old.review_status is distinct from new.review_status
      or old.reviewed_by_staff_id is distinct from new.reviewed_by_staff_id
      or old.reviewed_at is distinct from new.reviewed_at
    ) then
    insert into public.metadata_assignment_reviews (
      retailer_id,
      assignment_id,
      previous_status,
      review_status,
      reviewed_by_staff_id,
      source,
      confidence,
      supplier_value,
      evidence,
      created_at
    ) values (
      new.retailer_id,
      new.id,
      case when tg_op = 'UPDATE' then old.review_status else null end,
      new.review_status,
      new.reviewed_by_staff_id,
      new.source,
      new.confidence,
      new.supplier_value,
      new.evidence,
      new.reviewed_at
    );
  end if;
  return new;
end;
$$;

revoke all on function public.record_metadata_assignment_review() from public;

create trigger record_metadata_assignment_review_on_write
  after insert or update on public.entity_metadata_assignments
  for each row execute function public.record_metadata_assignment_review();

create table public.retailer_concept_overrides (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  concept_id uuid not null references public.metadata_concepts (id) on delete restrict,
  display_name text check (
    display_name is null
    or length(btrim(display_name)) between 1 and 200
  ),
  summary_override text check (
    summary_override is null
    or length(btrim(summary_override)) between 1 and 2000
  ),
  image_url_override text,
  is_hidden boolean not null default false,
  priority_override integer check (priority_override between -1000 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index retailer_concept_overrides_active_uidx
  on public.retailer_concept_overrides (retailer_id, concept_id);

create index retailer_concept_overrides_concept_idx
  on public.retailer_concept_overrides (concept_id, retailer_id)
  where deleted_at is null;

create trigger set_retailer_concept_overrides_updated_at
  before update on public.retailer_concept_overrides
  for each row execute function public.set_updated_at();

create or replace function public.enforce_retailer_concept_override_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_concept_retailer_id uuid;
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
    raise exception 'Metadata override concept does not belong to the retailer';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_retailer_concept_override_tenancy() from public;

create trigger enforce_retailer_concept_override_tenancy_on_write
  before insert or update on public.retailer_concept_overrides
  for each row execute function public.enforce_retailer_concept_override_tenancy();

create table public.product_fabric_profiles (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  product_variant_id uuid references public.product_variants (id) on delete cascade,
  fabric_weight_grams_per_square_metre numeric check (
    fabric_weight_grams_per_square_metre is null
    or (
      fabric_weight_grams_per_square_metre > 0
      and fabric_weight_grams_per_square_metre <= 2000
      and scale(fabric_weight_grams_per_square_metre) <= 2
    )
  ),
  supplier_reference text check (
    supplier_reference is null
    or length(btrim(supplier_reference)) between 1 and 200
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index product_fabric_profiles_product_uidx
  on public.product_fabric_profiles (product_id)
  where product_variant_id is null and deleted_at is null;

create unique index product_fabric_profiles_variant_uidx
  on public.product_fabric_profiles (product_variant_id)
  where product_variant_id is not null and deleted_at is null;

create index product_fabric_profiles_retailer_product_idx
  on public.product_fabric_profiles (retailer_id, product_id)
  where deleted_at is null;

create trigger set_product_fabric_profiles_updated_at
  before update on public.product_fabric_profiles
  for each row execute function public.set_updated_at();

create or replace function public.enforce_product_fabric_profile_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_product_retailer_id uuid;
  v_variant_product_id uuid;
begin
  if tg_op = 'UPDATE'
    and new.deleted_at is not null
    and old.deleted_at is null then
    return new;
  end if;

  select product.retailer_id into v_product_retailer_id
  from public.products as product
  where product.id = new.product_id
    and product.deleted_at is null;

  if v_product_retailer_id is null
    or v_product_retailer_id <> new.retailer_id then
    raise exception 'Fabric profile product does not belong to the retailer';
  end if;

  if new.product_variant_id is not null then
    select variant.product_id into v_variant_product_id
    from public.product_variants as variant
    where variant.id = new.product_variant_id
      and variant.deleted_at is null;

    if v_variant_product_id is null
      or v_variant_product_id <> new.product_id then
      raise exception 'Fabric profile variant does not belong to the product';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_product_fabric_profile_tenancy() from public;

create trigger enforce_product_fabric_profile_tenancy_on_write
  before insert or update on public.product_fabric_profiles
  for each row execute function public.enforce_product_fabric_profile_tenancy();

create table public.product_fabric_composition (
  profile_id uuid not null references public.product_fabric_profiles (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  fibre_concept_id uuid not null references public.metadata_concepts (id) on delete restrict,
  percentage numeric not null check (
    percentage > 0
    and percentage <= 100
    and scale(percentage) <= 4
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, fibre_concept_id)
);

create index product_fabric_composition_retailer_fibre_idx
  on public.product_fabric_composition (retailer_id, fibre_concept_id);

create trigger set_product_fabric_composition_updated_at
  before update on public.product_fabric_composition
  for each row execute function public.set_updated_at();

create or replace function public.enforce_product_fabric_composition_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_profile_retailer_id uuid;
  v_concept_retailer_id uuid;
  v_concept_kind public.metadata_concept_kind;
begin
  select profile.retailer_id into v_profile_retailer_id
  from public.product_fabric_profiles as profile
  where profile.id = new.profile_id
    and profile.deleted_at is null;

  if v_profile_retailer_id is null
    or v_profile_retailer_id <> new.retailer_id then
    raise exception 'Fabric composition profile does not belong to the retailer';
  end if;

  select concept.retailer_id, concept.kind
  into v_concept_retailer_id, v_concept_kind
  from public.metadata_concepts as concept
  where concept.id = new.fibre_concept_id
    and concept.deleted_at is null;

  if not found or v_concept_kind <> 'fibre' then
    raise exception 'Fabric composition requires an available fibre concept';
  end if;

  if v_concept_retailer_id is not null
    and v_concept_retailer_id <> new.retailer_id then
    raise exception 'Fabric composition concept does not belong to the retailer';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_product_fabric_composition_tenancy() from public;

create trigger enforce_product_fabric_composition_tenancy_on_write
  before insert or update on public.product_fabric_composition
  for each row execute function public.enforce_product_fabric_composition_tenancy();

create or replace function public.enforce_product_fabric_composition_total()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_component_count integer;
  v_total numeric;
begin
  v_profile_id := case when tg_op = 'DELETE' then old.profile_id else new.profile_id end;

  select count(*), coalesce(sum(component.percentage), 0)
  into v_component_count, v_total
  from public.product_fabric_composition as component
  where component.profile_id = v_profile_id;

  if v_component_count > 0 and v_total <> 100 then
    raise exception 'Fabric composition percentages must total exactly 100';
  end if;

  if tg_op = 'UPDATE' and old.profile_id <> new.profile_id then
    select count(*), coalesce(sum(component.percentage), 0)
    into v_component_count, v_total
    from public.product_fabric_composition as component
    where component.profile_id = old.profile_id;

    if v_component_count > 0 and v_total <> 100 then
      raise exception 'Fabric composition percentages must total exactly 100';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function public.enforce_product_fabric_composition_total() from public;

create constraint trigger enforce_product_fabric_composition_total_on_write
  after insert or update or delete on public.product_fabric_composition
  deferrable initially deferred
  for each row execute function public.enforce_product_fabric_composition_total();

-- RLS: platform staff manage the canonical/global layer. Standard retailer
-- staff can read canonical plus their tenant layer; manager and above can
-- manage tenant-owned rows. Workshop identities receive no metadata access.
alter table public.metadata_concepts enable row level security;
alter table public.metadata_concept_edges enable row level security;
alter table public.entity_metadata_assignments enable row level security;
alter table public.metadata_assignment_reviews enable row level security;
alter table public.retailer_concept_overrides enable row level security;
alter table public.product_fabric_profiles enable row level security;
alter table public.product_fabric_composition enable row level security;

create policy "authorized staff can read visible metadata concepts"
  on public.metadata_concepts for select to authenticated
  using (
    (select public.is_platform_staff())
    or (
      (retailer_id is null or retailer_id = (select public.current_retailer_id()))
      and (select public.current_retailer_role()) in (
        'read_only',
        'production_staff',
        'sales_associate',
        'manager',
        'admin',
        'owner'
      )
    )
  );

create policy "authorized staff can insert metadata concepts"
  on public.metadata_concepts for insert to authenticated
  with check (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "authorized staff can update metadata concepts"
  on public.metadata_concepts for update to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  )
  with check (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "authorized staff can delete metadata concepts"
  on public.metadata_concepts for delete to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "authorized staff can read visible metadata concept edges"
  on public.metadata_concept_edges for select to authenticated
  using (
    (select public.is_platform_staff())
    or (
      (retailer_id is null or retailer_id = (select public.current_retailer_id()))
      and (select public.current_retailer_role()) in (
        'read_only',
        'production_staff',
        'sales_associate',
        'manager',
        'admin',
        'owner'
      )
    )
  );

create policy "authorized staff can insert metadata concept edges"
  on public.metadata_concept_edges for insert to authenticated
  with check (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "authorized staff can update metadata concept edges"
  on public.metadata_concept_edges for update to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  )
  with check (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "authorized staff can delete metadata concept edges"
  on public.metadata_concept_edges for delete to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "authorized staff can read tenant metadata assignments"
  on public.entity_metadata_assignments for select to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in (
        'read_only',
        'production_staff',
        'sales_associate',
        'manager',
        'admin',
        'owner'
      )
    )
  );

create policy "authorized staff can insert tenant metadata assignments"
  on public.entity_metadata_assignments for insert to authenticated
  with check (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "authorized staff can update tenant metadata assignments"
  on public.entity_metadata_assignments for update to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  )
  with check (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "authorized staff can delete tenant metadata assignments"
  on public.entity_metadata_assignments for delete to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "authorized staff can read metadata assignment reviews"
  on public.metadata_assignment_reviews for select to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in (
        'read_only',
        'production_staff',
        'sales_associate',
        'manager',
        'admin',
        'owner'
      )
    )
  );

create policy "authorized staff can read tenant concept overrides"
  on public.retailer_concept_overrides for select to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in (
        'read_only',
        'production_staff',
        'sales_associate',
        'manager',
        'admin',
        'owner'
      )
    )
  );

create policy "authorized staff can insert tenant concept overrides"
  on public.retailer_concept_overrides for insert to authenticated
  with check (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "authorized staff can update tenant concept overrides"
  on public.retailer_concept_overrides for update to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  )
  with check (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "authorized staff can delete tenant concept overrides"
  on public.retailer_concept_overrides for delete to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "authorized staff can read tenant product fabric profiles"
  on public.product_fabric_profiles for select to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in (
        'read_only',
        'production_staff',
        'sales_associate',
        'manager',
        'admin',
        'owner'
      )
    )
  );

create policy "authorized staff can read tenant product fabric composition"
  on public.product_fabric_composition for select to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in (
        'read_only',
        'production_staff',
        'sales_associate',
        'manager',
        'admin',
        'owner'
      )
    )
  );

-- Exact product/variant facts and their composition are replaced in one
-- transaction. The definer function performs its own role and tenant checks;
-- direct authenticated writes to these two tables are never granted.
create or replace function public.set_product_fabric_profile(
  p_product_id uuid,
  p_product_variant_id uuid default null,
  p_fabric_weight_grams_per_square_metre numeric default null,
  p_supplier_reference text default null,
  p_composition jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retailer_id uuid;
  v_variant_product_id uuid;
  v_profile_id uuid;
  v_component_count integer;
  v_distinct_component_count integer;
  v_total numeric;
begin
  select product.retailer_id into v_retailer_id
  from public.products as product
  where product.id = p_product_id
    and product.deleted_at is null
  for update;

  if v_retailer_id is null then
    raise exception 'Product is unavailable';
  end if;

  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
    and not public.is_platform_staff()
    and (
      v_retailer_id <> public.current_retailer_id()
      or public.current_retailer_role() not in ('manager', 'admin', 'owner')
    ) then
    raise exception 'Not authorized to set product fabric profile';
  end if;

  if p_product_variant_id is not null then
    select variant.product_id into v_variant_product_id
    from public.product_variants as variant
    where variant.id = p_product_variant_id
      and variant.deleted_at is null;

    if v_variant_product_id is null or v_variant_product_id <> p_product_id then
      raise exception 'Product variant does not belong to product';
    end if;
  end if;

  if p_fabric_weight_grams_per_square_metre is not null
    and (
      p_fabric_weight_grams_per_square_metre <= 0
      or p_fabric_weight_grams_per_square_metre > 2000
      or scale(p_fabric_weight_grams_per_square_metre) > 2
    ) then
    raise exception 'Invalid fabric weight';
  end if;

  if jsonb_typeof(coalesce(p_composition, '[]'::jsonb)) <> 'array' then
    raise exception 'Fabric composition must be an array';
  end if;

  with components as (
    select
      (item ->> 'fibreConceptId')::uuid as fibre_concept_id,
      (item ->> 'percentage')::numeric as percentage
    from jsonb_array_elements(coalesce(p_composition, '[]'::jsonb)) as item
  )
  select
    count(*),
    count(distinct fibre_concept_id),
    coalesce(sum(percentage), 0)
  into v_component_count, v_distinct_component_count, v_total
  from components;

  if v_component_count <> v_distinct_component_count then
    raise exception 'A fibre concept may appear only once';
  end if;

  if v_component_count > 0 and v_total <> 100 then
    raise exception 'Fabric composition percentages must total exactly 100';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_composition, '[]'::jsonb)) as item
    where (item ->> 'percentage')::numeric <= 0
      or (item ->> 'percentage')::numeric > 100
      or scale((item ->> 'percentage')::numeric) > 4
  ) then
    raise exception 'Invalid fabric composition percentage';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_composition, '[]'::jsonb)) as item
    where not exists (
      select 1
      from public.metadata_concepts as concept
      where concept.id = (item ->> 'fibreConceptId')::uuid
        and concept.kind = 'fibre'
        and concept.deleted_at is null
        and (
          concept.retailer_id is null
          or concept.retailer_id = v_retailer_id
        )
    )
  ) then
    raise exception 'Fabric composition contains an unavailable fibre concept';
  end if;

  select profile.id into v_profile_id
  from public.product_fabric_profiles as profile
  where profile.product_id = p_product_id
    and profile.product_variant_id is not distinct from p_product_variant_id
    and profile.deleted_at is null
  for update;

  if v_profile_id is null then
    insert into public.product_fabric_profiles (
      retailer_id,
      product_id,
      product_variant_id,
      fabric_weight_grams_per_square_metre,
      supplier_reference
    ) values (
      v_retailer_id,
      p_product_id,
      p_product_variant_id,
      p_fabric_weight_grams_per_square_metre,
      nullif(btrim(p_supplier_reference), '')
    )
    returning id into v_profile_id;
  else
    update public.product_fabric_profiles
    set
      fabric_weight_grams_per_square_metre = p_fabric_weight_grams_per_square_metre,
      supplier_reference = nullif(btrim(p_supplier_reference), '')
    where id = v_profile_id;
  end if;

  delete from public.product_fabric_composition
  where profile_id = v_profile_id;

  insert into public.product_fabric_composition (
    profile_id,
    retailer_id,
    fibre_concept_id,
    percentage
  )
  select
    v_profile_id,
    v_retailer_id,
    (item ->> 'fibreConceptId')::uuid,
    (item ->> 'percentage')::numeric
  from jsonb_array_elements(coalesce(p_composition, '[]'::jsonb)) as item;

  return v_profile_id;
end;
$$;

revoke all on function public.set_product_fabric_profile(uuid, uuid, numeric, text, jsonb) from public;
grant execute on function public.set_product_fabric_profile(uuid, uuid, numeric, text, jsonb)
  to authenticated, service_role;

-- Explicit Data API exposure. RLS still decides which authenticated rows are
-- visible/mutable. Anonymous callers receive no metadata table privileges.
revoke all on table
  public.metadata_concepts,
  public.metadata_concept_edges,
  public.entity_metadata_assignments,
  public.metadata_assignment_reviews,
  public.retailer_concept_overrides,
  public.product_fabric_profiles,
  public.product_fabric_composition
from anon;

grant select, insert, update, delete on table
  public.metadata_concepts,
  public.metadata_concept_edges,
  public.entity_metadata_assignments,
  public.retailer_concept_overrides
to authenticated;

grant select on table
  public.metadata_assignment_reviews,
  public.product_fabric_profiles,
  public.product_fabric_composition
to authenticated;

grant select, insert, update, delete on table
  public.metadata_concepts,
  public.metadata_concept_edges,
  public.entity_metadata_assignments,
  public.metadata_assignment_reviews,
  public.retailer_concept_overrides,
  public.product_fabric_profiles,
  public.product_fabric_composition
to service_role;

comment on table public.metadata_concepts is
  'PAON canonical (retailer_id null) and retailer-owned menswear concepts; ADR-059.';
comment on table public.metadata_concept_edges is
  'Canonical or retailer-owned typed relationships between metadata concepts.';
comment on table public.entity_metadata_assignments is
  'Tenant-owned, reviewed concept assignments for products, variants and future wardrobe items.';
comment on table public.metadata_assignment_reviews is
  'Append-only audit history for accepted/rejected metadata assignment decisions.';
comment on table public.retailer_concept_overrides is
  'Tenant presentation and priority overrides that never mutate canonical concepts.';
comment on table public.product_fabric_profiles is
  'Exact product or variant fabric weight/reference facts; concept labels remain in metadata assignments.';
comment on table public.product_fabric_composition is
  'Exact concept-linked fibre percentages for one product fabric profile; non-empty totals equal 100.';
