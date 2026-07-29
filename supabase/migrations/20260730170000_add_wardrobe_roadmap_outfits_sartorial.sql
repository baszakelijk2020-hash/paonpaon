-- PAON Intelligence Platform Stage 4.2.
-- Wardrobe Roadmap, outfits, and approved sartorial rules
-- (ROAD-001, ROAD-002, ENG-002 / ADR-060 / ADR-063).

-- ---------------------------------------------------------------------------
-- Extend wardrobe category codes for shoes / pocket squares
-- ---------------------------------------------------------------------------

alter table public.wardrobe_items
  drop constraint if exists wardrobe_items_category_code_check;

alter table public.wardrobe_items
  add constraint wardrobe_items_category_code_check check (
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
      'shoes',
      'pocket_square',
      'other'
    )
  );

-- ---------------------------------------------------------------------------
-- sartorial_rules — founder/canonical or retailer-owned approved rules
-- ---------------------------------------------------------------------------

create table if not exists public.sartorial_rules (
  id uuid primary key default gen_random_uuid(),
  ownership_kind text not null check (
    ownership_kind in ('canonical', 'retailer')
  ),
  retailer_id uuid references public.retailers (id) on delete cascade,
  slug text not null check (
    length(btrim(slug)) between 1 and 120
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  title text not null check (length(btrim(title)) between 1 and 200),
  summary text not null check (length(btrim(summary)) between 1 and 500),
  rule_kind text not null check (
    rule_kind in (
      'slot_compatibility',
      'fabric',
      'colour',
      'formality',
      'occasion',
      'complete_look'
    )
  ),
  relation text not null check (
    relation in ('compatible', 'incompatible', 'requires', 'prefers')
  ),
  review_status text not null default 'pending' check (
    review_status in ('pending', 'accepted', 'rejected')
  ),
  subject_slot_kind text check (
    subject_slot_kind is null
    or subject_slot_kind in (
      'jacket',
      'trousers',
      'shirt',
      'shoes',
      'accessories',
      'pocket_square'
    )
  ),
  object_slot_kind text check (
    object_slot_kind is null
    or object_slot_kind in (
      'jacket',
      'trousers',
      'shirt',
      'shoes',
      'accessories',
      'pocket_square'
    )
  ),
  subject_concept_id uuid references public.metadata_concepts (id) on delete set null,
  object_concept_id uuid references public.metadata_concepts (id) on delete set null,
  knowledge_object_id uuid references public.knowledge_objects (id) on delete set null,
  explanation text not null check (length(btrim(explanation)) between 1 and 2000),
  created_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  reviewed_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sartorial_rules_ownership_retailer_chk check (
    (
      ownership_kind = 'canonical'
      and retailer_id is null
    )
    or (
      ownership_kind = 'retailer'
      and retailer_id is not null
    )
  ),
  constraint sartorial_rules_slot_pair_chk check (
    rule_kind not in ('slot_compatibility', 'complete_look')
    or (
      subject_slot_kind is not null
      and object_slot_kind is not null
    )
  )
);

create unique index if not exists sartorial_rules_canonical_slug_uidx
  on public.sartorial_rules (slug)
  where ownership_kind = 'canonical' and deleted_at is null;

create unique index if not exists sartorial_rules_retailer_slug_uidx
  on public.sartorial_rules (retailer_id, slug)
  where ownership_kind = 'retailer' and deleted_at is null;

create index if not exists sartorial_rules_review_idx
  on public.sartorial_rules (review_status, ownership_kind)
  where deleted_at is null;

create index if not exists sartorial_rules_retailer_idx
  on public.sartorial_rules (retailer_id, review_status)
  where deleted_at is null and retailer_id is not null;

comment on table public.sartorial_rules is
  'Approved founder/retailer sartorial compatibility rules (ROAD-002).';

create trigger set_sartorial_rules_updated_at
  before update on public.sartorial_rules
  for each row execute function public.set_updated_at();

create or replace function public.protect_sartorial_rule_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ownership_kind is distinct from old.ownership_kind
    or new.retailer_id is distinct from old.retailer_id
    or new.slug is distinct from old.slug then
    raise exception 'Sartorial rule identity fields are immutable';
  end if;
  if old.review_status <> 'pending'
    and new.review_status is distinct from old.review_status then
    raise exception 'Sartorial rule review status is terminal';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_sartorial_rule_identity() from public;

create trigger protect_sartorial_rule_identity_on_update
  before update on public.sartorial_rules
  for each row execute function public.protect_sartorial_rule_identity();

alter table public.sartorial_rules enable row level security;

revoke all on table public.sartorial_rules from anon;

create policy "authenticated read accepted or tenant sartorial rules"
  on public.sartorial_rules for select to authenticated
  using (
    deleted_at is null
    and (
      (
        ownership_kind = 'canonical'
        and review_status = 'accepted'
      )
      or (
        ownership_kind = 'retailer'
        and retailer_id = (select public.current_retailer_id())
        and (select public.current_retailer_role()) in (
          'sales_associate', 'manager', 'admin', 'owner'
        )
      )
      or (select public.is_platform_staff())
    )
  );

create policy "customers read accepted sartorial rules"
  on public.sartorial_rules for select to authenticated
  using (
    deleted_at is null
    and review_status = 'accepted'
    and (
      ownership_kind = 'canonical'
      or exists (
        select 1 from public.customers c
        where c.user_id = (select auth.uid())
          and c.retailer_id = sartorial_rules.retailer_id
          and c.deleted_at is null
      )
    )
  );

create policy "retailer staff insert tenant sartorial rules"
  on public.sartorial_rules for insert to authenticated
  with check (
    ownership_kind = 'retailer'
    and retailer_id = (select public.current_retailer_id())
    and review_status = 'pending'
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
    and created_by_staff_id = (select public.current_staff_id())
  );

create policy "platform staff insert canonical sartorial rules"
  on public.sartorial_rules for insert to authenticated
  with check (
    (select public.is_platform_staff())
    and ownership_kind = 'canonical'
    and retailer_id is null
  );

create policy "retailer managers review tenant sartorial rules"
  on public.sartorial_rules for update to authenticated
  using (
    ownership_kind = 'retailer'
    and retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'manager', 'admin', 'owner'
    )
  )
  with check (
    ownership_kind = 'retailer'
    and retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'manager', 'admin', 'owner'
    )
  );

create policy "platform staff update canonical sartorial rules"
  on public.sartorial_rules for update to authenticated
  using (
    (select public.is_platform_staff())
    and ownership_kind = 'canonical'
  )
  with check (
    (select public.is_platform_staff())
    and ownership_kind = 'canonical'
  );

grant select, insert, update on table public.sartorial_rules
  to authenticated, service_role;
grant all on table public.sartorial_rules to service_role;

-- Neutral accepted canonical fixtures (slot pairs for ROAD-002 complete looks)
insert into public.sartorial_rules (
  id, ownership_kind, slug, title, summary, rule_kind, relation,
  review_status, subject_slot_kind, object_slot_kind, explanation, reviewed_at
) values
  (
    '00000000-0000-4000-8000-00000000a001',
    'canonical',
    'jacket-trousers-foundation',
    'Jacket and trousers form the tailored foundation',
    'A complete look pairs jacket and trousers under approved guidance.',
    'slot_compatibility',
    'requires',
    'accepted',
    'jacket',
    'trousers',
    'Approved rule: a complete tailored look requires jacket and trousers together.',
    now()
  ),
  (
    '00000000-0000-4000-8000-00000000a002',
    'canonical',
    'jacket-shirt-layer',
    'Jacket sits over a shirt',
    'Shirt completes the jacket layer of a look.',
    'slot_compatibility',
    'requires',
    'accepted',
    'jacket',
    'shirt',
    'Approved rule: jacket looks cite a shirt layer for a complete outfit.',
    now()
  ),
  (
    '00000000-0000-4000-8000-00000000a003',
    'canonical',
    'trousers-shirt-balance',
    'Trousers and shirt balance the mid-layer',
    'Shirt and trousers must both be present for completeness.',
    'slot_compatibility',
    'compatible',
    'accepted',
    'trousers',
    'shirt',
    'Approved rule: trousers and shirt are compatible partners in a complete look.',
    now()
  ),
  (
    '00000000-0000-4000-8000-00000000a004',
    'canonical',
    'jacket-shoes-grounding',
    'Shoes ground the jacket look',
    'Complete looks include shoes with the jacket.',
    'slot_compatibility',
    'requires',
    'accepted',
    'jacket',
    'shoes',
    'Approved rule: a complete look includes shoes grounding the jacket outfit.',
    now()
  ),
  (
    '00000000-0000-4000-8000-00000000a005',
    'canonical',
    'shirt-accessories-finish',
    'Accessories finish the shirt layer',
    'Accessories complete the shirt-facing details of a look.',
    'slot_compatibility',
    'prefers',
    'accepted',
    'shirt',
    'accessories',
    'Approved rule: accessories finish the shirt layer of a complete look.',
    now()
  ),
  (
    '00000000-0000-4000-8000-00000000a006',
    'canonical',
    'jacket-pocket-square',
    'Pocket square accompanies the jacket',
    'Pocket squares belong with the jacket breast pocket.',
    'slot_compatibility',
    'compatible',
    'accepted',
    'jacket',
    'pocket_square',
    'Approved rule: pocket squares are compatible with jacket breast-pocket placement.',
    now()
  ),
  (
    '00000000-0000-4000-8000-00000000a007',
    'canonical',
    'shirt-pocket-square-harmony',
    'Pocket square relates to the shirt',
    'Pocket square colour/formality references the shirt.',
    'slot_compatibility',
    'prefers',
    'accepted',
    'shirt',
    'pocket_square',
    'Approved rule: pocket-square choices prefer harmony with the shirt.',
    now()
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- wardrobe_roadmaps — advisor-authored plans (ROAD-001)
-- ---------------------------------------------------------------------------

create table if not exists public.wardrobe_roadmaps (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  summary text check (
    summary is null or length(btrim(summary)) between 1 and 2000
  ),
  horizon_label text check (
    horizon_label is null or length(btrim(horizon_label)) between 1 and 80
  ),
  status text not null default 'draft' check (
    status in (
      'draft',
      'pending_approval',
      'approved',
      'rejected',
      'archived'
    )
  ),
  authored_by_staff_id uuid not null
    references public.retailer_staff_members (id) on delete restrict,
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by_actor text check (
    decided_by_actor is null
    or decided_by_actor in ('customer', 'advisor')
  ),
  customer_decision_note text check (
    customer_decision_note is null
    or length(btrim(customer_decision_note)) between 1 and 1000
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint wardrobe_roadmaps_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate
);

create index if not exists wardrobe_roadmaps_customer_idx
  on public.wardrobe_roadmaps (customer_id, status, created_at desc)
  where deleted_at is null;

create index if not exists wardrobe_roadmaps_retailer_idx
  on public.wardrobe_roadmaps (retailer_id, customer_id, created_at desc)
  where deleted_at is null;

comment on table public.wardrobe_roadmaps is
  'Advisor-authored wardrobe roadmaps scoped to one retailer relationship.';

create trigger set_wardrobe_roadmaps_updated_at
  before update on public.wardrobe_roadmaps
  for each row execute function public.set_updated_at();

create or replace function public.enforce_wardrobe_roadmap_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_staff_retailer_id uuid;
begin
  select staff.retailer_id into v_staff_retailer_id
  from public.retailer_staff_members as staff
  where staff.id = new.authored_by_staff_id
    and staff.deleted_at is null;
  if v_staff_retailer_id is null
    or v_staff_retailer_id <> new.retailer_id then
    raise exception 'Roadmap author does not belong to the retailer';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_wardrobe_roadmap_tenancy() from public;

create trigger enforce_wardrobe_roadmap_tenancy_on_write
  before insert or update on public.wardrobe_roadmaps
  for each row execute function public.enforce_wardrobe_roadmap_tenancy();

create or replace function public.protect_wardrobe_roadmap_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.retailer_id is distinct from old.retailer_id
    or new.customer_id is distinct from old.customer_id
    or new.authored_by_staff_id is distinct from old.authored_by_staff_id then
    raise exception 'Wardrobe roadmap identity fields are immutable';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_wardrobe_roadmap_identity() from public;

create trigger protect_wardrobe_roadmap_identity_on_update
  before update on public.wardrobe_roadmaps
  for each row execute function public.protect_wardrobe_roadmap_identity();

alter table public.wardrobe_roadmaps enable row level security;

revoke all on table public.wardrobe_roadmaps from anon;

create policy "customers read visible wardrobe roadmaps"
  on public.wardrobe_roadmaps for select to authenticated
  using (
    deleted_at is null
    and status in ('pending_approval', 'approved', 'rejected')
    and exists (
      select 1 from public.customers c
      where c.id = wardrobe_roadmaps.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant wardrobe roadmaps"
  on public.wardrobe_roadmaps for select to authenticated
  using (
    deleted_at is null
    and retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read wardrobe roadmaps"
  on public.wardrobe_roadmaps for select to authenticated
  using ((select public.is_platform_staff()));

create policy "retailer staff insert tenant wardrobe roadmaps"
  on public.wardrobe_roadmaps for insert to authenticated
  with check (
    retailer_id = (select public.current_retailer_id())
    and status = 'draft'
    and authored_by_staff_id = (select public.current_staff_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
    and exists (
      select 1 from public.customers c
      where c.id = wardrobe_roadmaps.customer_id
        and c.retailer_id = wardrobe_roadmaps.retailer_id
        and c.deleted_at is null
    )
  );

create policy "customers update pending wardrobe roadmaps"
  on public.wardrobe_roadmaps for update to authenticated
  using (
    deleted_at is null
    and status = 'pending_approval'
    and exists (
      select 1 from public.customers c
      where c.id = wardrobe_roadmaps.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  )
  with check (
    deleted_at is null
    and status in ('approved', 'rejected')
    and decided_by_actor = 'customer'
    and exists (
      select 1 from public.customers c
      where c.id = wardrobe_roadmaps.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff update tenant wardrobe roadmaps"
  on public.wardrobe_roadmaps for update to authenticated
  using (
    deleted_at is null
    and retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  )
  with check (
    deleted_at is null
    and retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

grant select, insert, update on table public.wardrobe_roadmaps
  to authenticated, service_role;
grant all on table public.wardrobe_roadmaps to service_role;

-- ---------------------------------------------------------------------------
-- roadmap goals / gaps / stages
-- ---------------------------------------------------------------------------

create table if not exists public.wardrobe_roadmap_goals (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.wardrobe_roadmaps (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text check (
    description is null or length(btrim(description)) between 1 and 2000
  ),
  display_order integer not null default 0 check (
    display_order between 0 and 100
  ),
  created_at timestamptz not null default now()
);

create index if not exists wardrobe_roadmap_goals_roadmap_idx
  on public.wardrobe_roadmap_goals (roadmap_id, display_order);

create table if not exists public.wardrobe_roadmap_gaps (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.wardrobe_roadmaps (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text check (
    description is null or length(btrim(description)) between 1 and 2000
  ),
  rank integer not null check (rank between 1 and 100),
  slot_kind text check (
    slot_kind is null
    or slot_kind in (
      'jacket',
      'trousers',
      'shirt',
      'shoes',
      'accessories',
      'pocket_square'
    )
  ),
  category_code text check (
    category_code is null
    or category_code in (
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
      'shoes',
      'pocket_square',
      'other'
    )
  ),
  filled_by_product_id uuid references public.products (id) on delete set null,
  filled_by_wardrobe_item_id uuid references public.wardrobe_items (id) on delete set null,
  how_purchase_fills_gap text check (
    how_purchase_fills_gap is null
    or length(btrim(how_purchase_fills_gap)) between 1 and 1000
  ),
  created_at timestamptz not null default now()
);

create index if not exists wardrobe_roadmap_gaps_roadmap_idx
  on public.wardrobe_roadmap_gaps (roadmap_id, rank);

create table if not exists public.wardrobe_roadmap_stages (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.wardrobe_roadmaps (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text check (
    description is null or length(btrim(description)) between 1 and 2000
  ),
  stage_order integer not null check (stage_order between 1 and 100),
  gap_id uuid references public.wardrobe_roadmap_gaps (id) on delete set null,
  suggested_product_id uuid references public.products (id) on delete set null,
  suggested_wardrobe_item_id uuid references public.wardrobe_items (id) on delete set null,
  explanation text not null check (length(btrim(explanation)) between 1 and 2000),
  rule_citations jsonb not null default '[]'::jsonb
    check (jsonb_typeof(rule_citations) = 'array'),
  fact_citations jsonb not null default '[]'::jsonb
    check (jsonb_typeof(fact_citations) = 'array'),
  created_at timestamptz not null default now(),
  constraint wardrobe_roadmap_stages_citations_chk check (
    jsonb_array_length(rule_citations) >= 1
    and jsonb_array_length(fact_citations) >= 1
  )
);

create index if not exists wardrobe_roadmap_stages_roadmap_idx
  on public.wardrobe_roadmap_stages (roadmap_id, stage_order);

create or replace function public.enforce_roadmap_child_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_roadmap_retailer_id uuid;
  v_product_retailer_id uuid;
  v_item_retailer_id uuid;
begin
  select roadmap.retailer_id into v_roadmap_retailer_id
  from public.wardrobe_roadmaps as roadmap
  where roadmap.id = new.roadmap_id
    and roadmap.deleted_at is null;
  if v_roadmap_retailer_id is null
    or v_roadmap_retailer_id <> new.retailer_id then
    raise exception 'Roadmap child does not match roadmap retailer';
  end if;

  if tg_table_name in ('wardrobe_roadmap_gaps', 'wardrobe_roadmap_stages') then
    if new.filled_by_product_id is not null then
      select product.retailer_id into v_product_retailer_id
      from public.products as product
      where product.id = new.filled_by_product_id
        and product.deleted_at is null;
      if v_product_retailer_id is null
        or v_product_retailer_id <> new.retailer_id then
        raise exception 'Roadmap product does not belong to the retailer';
      end if;
    end if;

    if tg_table_name = 'wardrobe_roadmap_gaps'
      and new.filled_by_wardrobe_item_id is not null then
      select item.retailer_id into v_item_retailer_id
      from public.wardrobe_items as item
      where item.id = new.filled_by_wardrobe_item_id
        and item.deleted_at is null;
      if v_item_retailer_id is null
        or v_item_retailer_id <> new.retailer_id then
        raise exception 'Roadmap wardrobe item does not belong to the retailer';
      end if;
    end if;

    if tg_table_name = 'wardrobe_roadmap_stages' then
      if new.suggested_product_id is not null then
        select product.retailer_id into v_product_retailer_id
        from public.products as product
        where product.id = new.suggested_product_id
          and product.deleted_at is null;
        if v_product_retailer_id is null
          or v_product_retailer_id <> new.retailer_id then
          raise exception 'Roadmap suggested product does not belong to the retailer';
        end if;
      end if;

      if new.suggested_wardrobe_item_id is not null then
        select item.retailer_id into v_item_retailer_id
        from public.wardrobe_items as item
        where item.id = new.suggested_wardrobe_item_id
          and item.deleted_at is null;
        if v_item_retailer_id is null
          or v_item_retailer_id <> new.retailer_id then
          raise exception 'Roadmap suggested wardrobe item does not belong to the retailer';
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_roadmap_child_tenancy() from public;

-- Gaps trigger uses filled_by_* columns; stages use suggested_*.
-- Split into two functions to keep column references valid.

create or replace function public.enforce_roadmap_goal_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_roadmap_retailer_id uuid;
begin
  select roadmap.retailer_id into v_roadmap_retailer_id
  from public.wardrobe_roadmaps as roadmap
  where roadmap.id = new.roadmap_id
    and roadmap.deleted_at is null;
  if v_roadmap_retailer_id is null
    or v_roadmap_retailer_id <> new.retailer_id then
    raise exception 'Roadmap child does not match roadmap retailer';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_roadmap_goal_tenancy() from public;

create trigger enforce_roadmap_goal_tenancy_on_write
  before insert or update on public.wardrobe_roadmap_goals
  for each row execute function public.enforce_roadmap_goal_tenancy();

create or replace function public.enforce_roadmap_gap_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_roadmap_retailer_id uuid;
  v_product_retailer_id uuid;
  v_item_retailer_id uuid;
begin
  select roadmap.retailer_id into v_roadmap_retailer_id
  from public.wardrobe_roadmaps as roadmap
  where roadmap.id = new.roadmap_id
    and roadmap.deleted_at is null;
  if v_roadmap_retailer_id is null
    or v_roadmap_retailer_id <> new.retailer_id then
    raise exception 'Roadmap child does not match roadmap retailer';
  end if;

  if new.filled_by_product_id is not null then
    select product.retailer_id into v_product_retailer_id
    from public.products as product
    where product.id = new.filled_by_product_id
      and product.deleted_at is null;
    if v_product_retailer_id is null
      or v_product_retailer_id <> new.retailer_id then
      raise exception 'Roadmap product does not belong to the retailer';
    end if;
  end if;

  if new.filled_by_wardrobe_item_id is not null then
    select item.retailer_id into v_item_retailer_id
    from public.wardrobe_items as item
    where item.id = new.filled_by_wardrobe_item_id
      and item.deleted_at is null;
    if v_item_retailer_id is null
      or v_item_retailer_id <> new.retailer_id then
      raise exception 'Roadmap wardrobe item does not belong to the retailer';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_roadmap_gap_tenancy() from public;

create trigger enforce_roadmap_gap_tenancy_on_write
  before insert or update on public.wardrobe_roadmap_gaps
  for each row execute function public.enforce_roadmap_gap_tenancy();

create or replace function public.enforce_roadmap_stage_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_roadmap_retailer_id uuid;
  v_product_retailer_id uuid;
  v_item_retailer_id uuid;
begin
  select roadmap.retailer_id into v_roadmap_retailer_id
  from public.wardrobe_roadmaps as roadmap
  where roadmap.id = new.roadmap_id
    and roadmap.deleted_at is null;
  if v_roadmap_retailer_id is null
    or v_roadmap_retailer_id <> new.retailer_id then
    raise exception 'Roadmap child does not match roadmap retailer';
  end if;

  if new.suggested_product_id is not null then
    select product.retailer_id into v_product_retailer_id
    from public.products as product
    where product.id = new.suggested_product_id
      and product.deleted_at is null;
    if v_product_retailer_id is null
      or v_product_retailer_id <> new.retailer_id then
      raise exception 'Roadmap suggested product does not belong to the retailer';
    end if;
  end if;

  if new.suggested_wardrobe_item_id is not null then
    select item.retailer_id into v_item_retailer_id
    from public.wardrobe_items as item
    where item.id = new.suggested_wardrobe_item_id
      and item.deleted_at is null;
    if v_item_retailer_id is null
      or v_item_retailer_id <> new.retailer_id then
      raise exception 'Roadmap suggested wardrobe item does not belong to the retailer';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_roadmap_stage_tenancy() from public;

create trigger enforce_roadmap_stage_tenancy_on_write
  before insert or update on public.wardrobe_roadmap_stages
  for each row execute function public.enforce_roadmap_stage_tenancy();

-- Drop the unused combined function if created above
drop function if exists public.enforce_roadmap_child_tenancy();

alter table public.wardrobe_roadmap_goals enable row level security;
alter table public.wardrobe_roadmap_gaps enable row level security;
alter table public.wardrobe_roadmap_stages enable row level security;

revoke all on table public.wardrobe_roadmap_goals from anon;
revoke all on table public.wardrobe_roadmap_gaps from anon;
revoke all on table public.wardrobe_roadmap_stages from anon;

create policy "customers read visible roadmap goals"
  on public.wardrobe_roadmap_goals for select to authenticated
  using (
    exists (
      select 1 from public.wardrobe_roadmaps r
      join public.customers c on c.id = r.customer_id
      where r.id = wardrobe_roadmap_goals.roadmap_id
        and r.deleted_at is null
        and r.status in ('pending_approval', 'approved', 'rejected')
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant roadmap goals"
  on public.wardrobe_roadmap_goals for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "retailer staff insert tenant roadmap goals"
  on public.wardrobe_roadmap_goals for insert to authenticated
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "customers read visible roadmap gaps"
  on public.wardrobe_roadmap_gaps for select to authenticated
  using (
    exists (
      select 1 from public.wardrobe_roadmaps r
      join public.customers c on c.id = r.customer_id
      where r.id = wardrobe_roadmap_gaps.roadmap_id
        and r.deleted_at is null
        and r.status in ('pending_approval', 'approved', 'rejected')
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant roadmap gaps"
  on public.wardrobe_roadmap_gaps for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "retailer staff insert tenant roadmap gaps"
  on public.wardrobe_roadmap_gaps for insert to authenticated
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "customers read visible roadmap stages"
  on public.wardrobe_roadmap_stages for select to authenticated
  using (
    exists (
      select 1 from public.wardrobe_roadmaps r
      join public.customers c on c.id = r.customer_id
      where r.id = wardrobe_roadmap_stages.roadmap_id
        and r.deleted_at is null
        and r.status in ('pending_approval', 'approved', 'rejected')
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant roadmap stages"
  on public.wardrobe_roadmap_stages for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "retailer staff insert tenant roadmap stages"
  on public.wardrobe_roadmap_stages for insert to authenticated
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

grant select, insert on table public.wardrobe_roadmap_goals
  to authenticated, service_role;
grant select, insert on table public.wardrobe_roadmap_gaps
  to authenticated, service_role;
grant select, insert on table public.wardrobe_roadmap_stages
  to authenticated, service_role;
grant all on table public.wardrobe_roadmap_goals to service_role;
grant all on table public.wardrobe_roadmap_gaps to service_role;
grant all on table public.wardrobe_roadmap_stages to service_role;

-- ---------------------------------------------------------------------------
-- outfits + outfit_slots — complete looks
-- ---------------------------------------------------------------------------

create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  roadmap_id uuid references public.wardrobe_roadmaps (id) on delete set null,
  title text not null check (length(btrim(title)) between 1 and 200),
  occasion_label text check (
    occasion_label is null or length(btrim(occasion_label)) between 1 and 120
  ),
  notes text check (
    notes is null or length(btrim(notes)) between 1 and 2000
  ),
  created_by_staff_id uuid not null
    references public.retailer_staff_members (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint outfits_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate
);

create index if not exists outfits_customer_idx
  on public.outfits (customer_id, created_at desc)
  where deleted_at is null;

create index if not exists outfits_roadmap_idx
  on public.outfits (roadmap_id)
  where roadmap_id is not null and deleted_at is null;

comment on table public.outfits is
  'Complete looks spanning jacket/trousers/shirt/shoes/accessories/pocket-square.';

create trigger set_outfits_updated_at
  before update on public.outfits
  for each row execute function public.set_updated_at();

create table if not exists public.outfit_slots (
  id uuid primary key default gen_random_uuid(),
  outfit_id uuid not null references public.outfits (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  slot_kind text not null check (
    slot_kind in (
      'jacket',
      'trousers',
      'shirt',
      'shoes',
      'accessories',
      'pocket_square'
    )
  ),
  wardrobe_item_id uuid references public.wardrobe_items (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  label text not null check (length(btrim(label)) between 1 and 200),
  available boolean not null default true,
  display_order integer not null default 0 check (
    display_order between 0 and 100
  ),
  created_at timestamptz not null default now(),
  constraint outfit_slots_unique_kind unique (outfit_id, slot_kind),
  constraint outfit_slots_reference_chk check (
    (
      available = true
      and (
        (wardrobe_item_id is not null and product_id is null)
        or (wardrobe_item_id is null and product_id is not null)
      )
    )
    or (
      available = false
      and wardrobe_item_id is null
      and product_id is null
    )
  )
);

create index if not exists outfit_slots_outfit_idx
  on public.outfit_slots (outfit_id, display_order);

create or replace function public.enforce_outfit_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_staff_retailer_id uuid;
  v_roadmap_retailer_id uuid;
  v_roadmap_customer_id uuid;
begin
  select staff.retailer_id into v_staff_retailer_id
  from public.retailer_staff_members as staff
  where staff.id = new.created_by_staff_id
    and staff.deleted_at is null;
  if v_staff_retailer_id is null
    or v_staff_retailer_id <> new.retailer_id then
    raise exception 'Outfit author does not belong to the retailer';
  end if;

  if new.roadmap_id is not null then
    select roadmap.retailer_id, roadmap.customer_id
      into v_roadmap_retailer_id, v_roadmap_customer_id
    from public.wardrobe_roadmaps as roadmap
    where roadmap.id = new.roadmap_id
      and roadmap.deleted_at is null;
    if v_roadmap_retailer_id is null
      or v_roadmap_retailer_id <> new.retailer_id
      or v_roadmap_customer_id <> new.customer_id then
      raise exception 'Outfit roadmap does not belong to the relationship';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_outfit_tenancy() from public;

create trigger enforce_outfit_tenancy_on_write
  before insert or update on public.outfits
  for each row execute function public.enforce_outfit_tenancy();

create or replace function public.enforce_outfit_slot_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_outfit_retailer_id uuid;
  v_product_retailer_id uuid;
  v_item_retailer_id uuid;
begin
  select outfit.retailer_id into v_outfit_retailer_id
  from public.outfits as outfit
  where outfit.id = new.outfit_id
    and outfit.deleted_at is null;
  if v_outfit_retailer_id is null
    or v_outfit_retailer_id <> new.retailer_id then
    raise exception 'Outfit slot does not match outfit retailer';
  end if;

  if new.product_id is not null then
    select product.retailer_id into v_product_retailer_id
    from public.products as product
    where product.id = new.product_id
      and product.deleted_at is null;
    if v_product_retailer_id is null
      or v_product_retailer_id <> new.retailer_id then
      raise exception 'Outfit product does not belong to the retailer';
    end if;
  end if;

  if new.wardrobe_item_id is not null then
    select item.retailer_id into v_item_retailer_id
    from public.wardrobe_items as item
    where item.id = new.wardrobe_item_id
      and item.deleted_at is null;
    if v_item_retailer_id is null
      or v_item_retailer_id <> new.retailer_id then
      raise exception 'Outfit wardrobe item does not belong to the retailer';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_outfit_slot_tenancy() from public;

create trigger enforce_outfit_slot_tenancy_on_write
  before insert or update on public.outfit_slots
  for each row execute function public.enforce_outfit_slot_tenancy();

alter table public.outfits enable row level security;
alter table public.outfit_slots enable row level security;

revoke all on table public.outfits from anon;
revoke all on table public.outfit_slots from anon;

create policy "customers read own outfits"
  on public.outfits for select to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.customers c
      where c.id = outfits.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant outfits"
  on public.outfits for select to authenticated
  using (
    deleted_at is null
    and retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "retailer staff insert tenant outfits"
  on public.outfits for insert to authenticated
  with check (
    retailer_id = (select public.current_retailer_id())
    and created_by_staff_id = (select public.current_staff_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
    and exists (
      select 1 from public.customers c
      where c.id = outfits.customer_id
        and c.retailer_id = outfits.retailer_id
        and c.deleted_at is null
    )
  );

create policy "customers read own outfit slots"
  on public.outfit_slots for select to authenticated
  using (
    exists (
      select 1 from public.outfits o
      join public.customers c on c.id = o.customer_id
      where o.id = outfit_slots.outfit_id
        and o.deleted_at is null
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant outfit slots"
  on public.outfit_slots for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "retailer staff insert tenant outfit slots"
  on public.outfit_slots for insert to authenticated
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

grant select, insert, update on table public.outfits
  to authenticated, service_role;
grant select, insert on table public.outfit_slots
  to authenticated, service_role;
grant all on table public.outfits to service_role;
grant all on table public.outfit_slots to service_role;
