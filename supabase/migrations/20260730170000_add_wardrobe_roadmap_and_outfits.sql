-- PAON Intelligence Platform Stage 4.2.
-- Wardrobe Roadmaps, outfits, and sartorial rule citations (ROAD-001, ROAD-002,
-- ADR-060, ADR-063).

-- ---------------------------------------------------------------------------
-- wardrobe_roadmaps — advisor-authored plans for one relationship
-- ---------------------------------------------------------------------------

create table if not exists public.wardrobe_roadmaps (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  summary text check (summary is null or length(btrim(summary)) between 1 and 2000),
  horizon_label text check (
    horizon_label is null or length(btrim(horizon_label)) between 1 and 80
  ),
  status text not null default 'draft' check (
    status in ('draft', 'proposed', 'approved', 'archived')
  ),
  created_by_staff_id uuid not null references public.retailer_staff_members (id) on delete restrict,
  approved_at timestamptz,
  approved_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wardrobe_roadmaps_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint wardrobe_roadmaps_id_retailer_unique unique (id, retailer_id),
  constraint wardrobe_roadmaps_approval_chk check (
    (status = 'approved' and approved_at is not null and approved_by_staff_id is not null)
    or status <> 'approved'
  )
);

create index if not exists wardrobe_roadmaps_customer_idx
  on public.wardrobe_roadmaps (customer_id, created_at desc);

create index if not exists wardrobe_roadmaps_retailer_customer_idx
  on public.wardrobe_roadmaps (retailer_id, customer_id, status);

comment on table public.wardrobe_roadmaps is
  'Advisor-authored Wardrobe Roadmap plans scoped to one retailer-customer relationship (ADR-063).';

create trigger set_wardrobe_roadmaps_updated_at
  before update on public.wardrobe_roadmaps
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- wardrobe_roadmap_goals — ranked goals inside a roadmap
-- ---------------------------------------------------------------------------

create table if not exists public.wardrobe_roadmap_goals (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.wardrobe_roadmaps (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text check (
    description is null or length(btrim(description)) between 1 and 2000
  ),
  rank integer not null check (rank between 1 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wardrobe_roadmap_goals_roadmap_retailer_fk
    foreign key (roadmap_id, retailer_id)
    references public.wardrobe_roadmaps (id, retailer_id)
    deferrable initially immediate,
  unique (roadmap_id, rank)
);

create index if not exists wardrobe_roadmap_goals_roadmap_idx
  on public.wardrobe_roadmap_goals (roadmap_id, rank);

comment on table public.wardrobe_roadmap_goals is
  'Ranked wardrobe goals within an advisor roadmap (ROAD-001).';

create trigger set_wardrobe_roadmap_goals_updated_at
  before update on public.wardrobe_roadmap_goals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- wardrobe_gaps — ranked gaps with staged purchase priorities
-- ---------------------------------------------------------------------------

create table if not exists public.wardrobe_gaps (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.wardrobe_roadmaps (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text check (
    description is null or length(btrim(description)) between 1 and 2000
  ),
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
  rank integer not null check (rank between 1 and 99),
  stage_priority integer not null default 1 check (stage_priority between 1 and 5),
  status text not null default 'open' check (
    status in ('open', 'filled', 'deferred')
  ),
  concept_id uuid references public.metadata_concepts (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  wardrobe_item_id uuid references public.wardrobe_items (id) on delete set null,
  knowledge_object_id uuid references public.knowledge_objects (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wardrobe_gaps_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint wardrobe_gaps_roadmap_retailer_fk
    foreign key (roadmap_id, retailer_id)
    references public.wardrobe_roadmaps (id, retailer_id)
    deferrable initially immediate,
  unique (roadmap_id, rank)
);

create index if not exists wardrobe_gaps_roadmap_idx
  on public.wardrobe_gaps (roadmap_id, rank, stage_priority);

comment on table public.wardrobe_gaps is
  'Ranked wardrobe gaps with staged priorities and approved rule citations (ROAD-001).';

create trigger set_wardrobe_gaps_updated_at
  before update on public.wardrobe_gaps
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- outfits — complete looks for one relationship
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
  status text not null default 'draft' check (
    status in ('draft', 'proposed', 'approved')
  ),
  created_by_staff_id uuid not null references public.retailer_staff_members (id) on delete restrict,
  approved_at timestamptz,
  approved_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outfits_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint outfits_id_retailer_unique unique (id, retailer_id),
  constraint outfits_approval_chk check (
    (status = 'approved' and approved_at is not null and approved_by_staff_id is not null)
    or status <> 'approved'
  )
);

create index if not exists outfits_customer_idx
  on public.outfits (customer_id, created_at desc);

create index if not exists outfits_retailer_customer_idx
  on public.outfits (retailer_id, customer_id, status);

comment on table public.outfits is
  'Complete looks referencing owned wardrobe and catalogue items (ROAD-002 / ADR-063).';

create trigger set_outfits_updated_at
  before update on public.outfits
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- outfit_slots — jacket/trouser/shirt/shoe/accessory/pocket-square slots
-- ---------------------------------------------------------------------------

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
  sort_order integer not null default 0 check (sort_order between 0 and 20),
  display_label text not null check (
    length(btrim(display_label)) between 1 and 200
  ),
  wardrobe_item_id uuid references public.wardrobe_items (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint outfit_slots_outfit_retailer_fk
    foreign key (outfit_id, retailer_id)
    references public.outfits (id, retailer_id)
    deferrable initially immediate,
  constraint outfit_slots_reference_chk check (
    wardrobe_item_id is not null or product_id is not null or length(btrim(display_label)) > 0
  ),
  constraint outfit_slots_single_reference_chk check (
    not (wardrobe_item_id is not null and product_id is not null)
  )
);

create index if not exists outfit_slots_outfit_idx
  on public.outfit_slots (outfit_id, sort_order);

comment on table public.outfit_slots is
  'Outfit composition slots referencing owned or catalogue pieces.';

-- ---------------------------------------------------------------------------
-- outfit_rule_citations — approved knowledge backing each look
-- ---------------------------------------------------------------------------

create table if not exists public.outfit_rule_citations (
  id uuid primary key default gen_random_uuid(),
  outfit_id uuid not null references public.outfits (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  knowledge_object_id uuid not null references public.knowledge_objects (id) on delete restrict,
  explanation text not null check (
    length(btrim(explanation)) between 1 and 2000
  ),
  slot_kind_a text check (
    slot_kind_a is null
    or slot_kind_a in (
      'jacket',
      'trousers',
      'shirt',
      'shoes',
      'accessories',
      'pocket_square'
    )
  ),
  slot_kind_b text check (
    slot_kind_b is null
    or slot_kind_b in (
      'jacket',
      'trousers',
      'shirt',
      'shoes',
      'accessories',
      'pocket_square'
    )
  ),
  created_at timestamptz not null default now(),
  constraint outfit_rule_citations_outfit_retailer_fk
    foreign key (outfit_id, retailer_id)
    references public.outfits (id, retailer_id)
    deferrable initially immediate
);

create index if not exists outfit_rule_citations_outfit_idx
  on public.outfit_rule_citations (outfit_id);

comment on table public.outfit_rule_citations is
  'Approved knowledge citations explaining outfit compatibility (ADR-060).';

-- ---------------------------------------------------------------------------
-- Tenancy enforcement triggers
-- ---------------------------------------------------------------------------

create or replace function public.enforce_wardrobe_roadmap_reference_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.product_id is not null then
    if not exists (
      select 1 from public.products p
      where p.id = new.product_id and p.retailer_id = new.retailer_id
    ) then
      raise exception 'Roadmap gap product does not belong to the retailer';
    end if;
  end if;

  if new.wardrobe_item_id is not null then
    if not exists (
      select 1 from public.wardrobe_items wi
      where wi.id = new.wardrobe_item_id
        and wi.retailer_id = new.retailer_id
        and wi.customer_id = new.customer_id
    ) then
      raise exception 'Roadmap gap wardrobe item does not belong to the relationship';
    end if;
  end if;

  return new;
end;
$$;

create trigger enforce_wardrobe_gaps_reference_tenancy
  before insert or update on public.wardrobe_gaps
  for each row execute function public.enforce_wardrobe_roadmap_reference_tenancy();

create or replace function public.enforce_outfit_slot_reference_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_customer_id uuid;
begin
  select o.customer_id into v_customer_id
  from public.outfits o
  where o.id = new.outfit_id;

  if new.product_id is not null then
    if not exists (
      select 1 from public.products p
      where p.id = new.product_id and p.retailer_id = new.retailer_id
    ) then
      raise exception 'Outfit slot product does not belong to the retailer';
    end if;
  end if;

  if new.wardrobe_item_id is not null then
    if not exists (
      select 1 from public.wardrobe_items wi
      where wi.id = new.wardrobe_item_id
        and wi.retailer_id = new.retailer_id
        and wi.customer_id = v_customer_id
    ) then
      raise exception 'Outfit slot wardrobe item does not belong to the relationship';
    end if;
  end if;

  return new;
end;
$$;

create trigger enforce_outfit_slots_reference_tenancy
  before insert or update on public.outfit_slots
  for each row execute function public.enforce_outfit_slot_reference_tenancy();

-- ---------------------------------------------------------------------------
-- RLS — wardrobe_roadmaps
-- ---------------------------------------------------------------------------

alter table public.wardrobe_roadmaps enable row level security;
revoke all on table public.wardrobe_roadmaps from anon;

create policy "customers read approved wardrobe roadmaps"
  on public.wardrobe_roadmaps for select to authenticated
  using (
    status = 'approved'
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
    retailer_id = (select public.current_retailer_id())
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
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
    and created_by_staff_id = (select public.current_staff_id())
    and exists (
      select 1 from public.customers c
      where c.id = wardrobe_roadmaps.customer_id
        and c.retailer_id = wardrobe_roadmaps.retailer_id
        and c.deleted_at is null
    )
  );

create policy "retailer staff update tenant wardrobe roadmaps"
  on public.wardrobe_roadmaps for update to authenticated
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

grant select, insert, update on table public.wardrobe_roadmaps
  to authenticated, service_role;
grant all on table public.wardrobe_roadmaps to service_role;

-- ---------------------------------------------------------------------------
-- RLS — wardrobe_roadmap_goals
-- ---------------------------------------------------------------------------

alter table public.wardrobe_roadmap_goals enable row level security;
revoke all on table public.wardrobe_roadmap_goals from anon;

create policy "customers read approved wardrobe roadmap goals"
  on public.wardrobe_roadmap_goals for select to authenticated
  using (
    exists (
      select 1
      from public.wardrobe_roadmaps r
      join public.customers c on c.id = r.customer_id
      where r.id = wardrobe_roadmap_goals.roadmap_id
        and r.status = 'approved'
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant wardrobe roadmap goals"
  on public.wardrobe_roadmap_goals for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read wardrobe roadmap goals"
  on public.wardrobe_roadmap_goals for select to authenticated
  using ((select public.is_platform_staff()));

create policy "retailer staff manage tenant wardrobe roadmap goals"
  on public.wardrobe_roadmap_goals for all to authenticated
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

grant select, insert, update, delete on table public.wardrobe_roadmap_goals
  to authenticated, service_role;
grant all on table public.wardrobe_roadmap_goals to service_role;

-- ---------------------------------------------------------------------------
-- RLS — wardrobe_gaps
-- ---------------------------------------------------------------------------

alter table public.wardrobe_gaps enable row level security;
revoke all on table public.wardrobe_gaps from anon;

create policy "customers read approved wardrobe gaps"
  on public.wardrobe_gaps for select to authenticated
  using (
    exists (
      select 1
      from public.wardrobe_roadmaps r
      join public.customers c on c.id = r.customer_id
      where r.id = wardrobe_gaps.roadmap_id
        and r.status = 'approved'
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant wardrobe gaps"
  on public.wardrobe_gaps for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read wardrobe gaps"
  on public.wardrobe_gaps for select to authenticated
  using ((select public.is_platform_staff()));

create policy "retailer staff manage tenant wardrobe gaps"
  on public.wardrobe_gaps for all to authenticated
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

grant select, insert, update, delete on table public.wardrobe_gaps
  to authenticated, service_role;
grant all on table public.wardrobe_gaps to service_role;

-- ---------------------------------------------------------------------------
-- RLS — outfits and children
-- ---------------------------------------------------------------------------

alter table public.outfits enable row level security;
revoke all on table public.outfits from anon;

create policy "customers read approved outfits"
  on public.outfits for select to authenticated
  using (
    status = 'approved'
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
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read outfits"
  on public.outfits for select to authenticated
  using ((select public.is_platform_staff()));

create policy "retailer staff insert tenant outfits"
  on public.outfits for insert to authenticated
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
    and created_by_staff_id = (select public.current_staff_id())
    and exists (
      select 1 from public.customers c
      where c.id = outfits.customer_id
        and c.retailer_id = outfits.retailer_id
        and c.deleted_at is null
    )
  );

create policy "retailer staff update tenant outfits"
  on public.outfits for update to authenticated
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

grant select, insert, update on table public.outfits
  to authenticated, service_role;
grant all on table public.outfits to service_role;

alter table public.outfit_slots enable row level security;
revoke all on table public.outfit_slots from anon;

create policy "customers read approved outfit slots"
  on public.outfit_slots for select to authenticated
  using (
    exists (
      select 1
      from public.outfits o
      join public.customers c on c.id = o.customer_id
      where o.id = outfit_slots.outfit_id
        and o.status = 'approved'
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff manage tenant outfit slots"
  on public.outfit_slots for all to authenticated
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

create policy "platform staff read outfit slots"
  on public.outfit_slots for select to authenticated
  using ((select public.is_platform_staff()));

grant select, insert, update, delete on table public.outfit_slots
  to authenticated, service_role;
grant all on table public.outfit_slots to service_role;

alter table public.outfit_rule_citations enable row level security;
revoke all on table public.outfit_rule_citations from anon;

create policy "customers read approved outfit rule citations"
  on public.outfit_rule_citations for select to authenticated
  using (
    exists (
      select 1
      from public.outfits o
      join public.customers c on c.id = o.customer_id
      where o.id = outfit_rule_citations.outfit_id
        and o.status = 'approved'
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff manage tenant outfit rule citations"
  on public.outfit_rule_citations for all to authenticated
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

create policy "platform staff read outfit rule citations"
  on public.outfit_rule_citations for select to authenticated
  using ((select public.is_platform_staff()));

grant select, insert, update, delete on table public.outfit_rule_citations
  to authenticated, service_role;
grant all on table public.outfit_rule_citations to service_role;
