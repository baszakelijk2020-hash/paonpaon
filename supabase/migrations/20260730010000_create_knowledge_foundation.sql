-- PAON Intelligence Platform Stage 2.1.
-- Canonical knowledge objects are platform-owned (retailer_id is null).
-- Retailers own local knowledge rows and presentation overrides only; they
-- never mutate canonical copy. RLS is enabled with explicit Data API grants.

create type public.knowledge_topic as enum (
  'mill',
  'fibre',
  'fabric',
  'weave',
  'construction',
  'collar',
  'styling',
  'care',
  'performance',
  'occasion',
  'value',
  'tradeoff'
);

create type public.knowledge_display_type as enum (
  'information_card',
  'accordion',
  'tooltip',
  'comparison',
  'advisor_answer'
);

create type public.knowledge_commercial_intent as enum (
  'educate',
  'justify_premium',
  'upgrade',
  'cross_sell',
  'appointment'
);

create table public.knowledge_objects (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid references public.retailers (id) on delete cascade,
  topic public.knowledge_topic not null,
  title text not null check (length(btrim(title)) between 1 and 200),
  slug text not null check (
    length(slug) between 1 and 120
    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  summary text not null check (length(btrim(summary)) between 1 and 2000),
  body text check (
    body is null
    or length(btrim(body)) between 1 and 20000
  ),
  image_url text,
  display_types public.knowledge_display_type[] not null
    check (cardinality(display_types) between 1 and 5),
  commercial_intent public.knowledge_commercial_intent not null,
  priority integer not null default 0 check (priority between -1000 and 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index knowledge_objects_canonical_slug_uidx
  on public.knowledge_objects (slug)
  where retailer_id is null;

create unique index knowledge_objects_retailer_slug_uidx
  on public.knowledge_objects (retailer_id, slug)
  where retailer_id is not null;

create index knowledge_objects_canonical_topic_active_idx
  on public.knowledge_objects (topic, active)
  where retailer_id is null and deleted_at is null;

create index knowledge_objects_retailer_topic_active_idx
  on public.knowledge_objects (retailer_id, topic, active)
  where deleted_at is null;

create trigger set_knowledge_objects_updated_at
  before update on public.knowledge_objects
  for each row execute function public.set_updated_at();

create table public.knowledge_object_concepts (
  id uuid primary key default gen_random_uuid(),
  knowledge_object_id uuid not null
    references public.knowledge_objects (id) on delete cascade,
  concept_id uuid not null
    references public.metadata_concepts (id) on delete restrict,
  match_strength numeric not null default 1 check (
    match_strength between 0 and 1
    and scale(match_strength) <= 4
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index knowledge_object_concepts_active_uidx
  on public.knowledge_object_concepts (knowledge_object_id, concept_id)
  where deleted_at is null;

create index knowledge_object_concepts_concept_idx
  on public.knowledge_object_concepts (concept_id)
  where deleted_at is null;

create trigger set_knowledge_object_concepts_updated_at
  before update on public.knowledge_object_concepts
  for each row execute function public.set_updated_at();

create or replace function public.enforce_knowledge_object_concept_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_object_retailer_id uuid;
  v_concept_retailer_id uuid;
begin
  if tg_op = 'UPDATE'
    and new.deleted_at is not null
    and old.deleted_at is null then
    return new;
  end if;

  select knowledge_object.retailer_id into v_object_retailer_id
  from public.knowledge_objects as knowledge_object
  where knowledge_object.id = new.knowledge_object_id
    and knowledge_object.deleted_at is null;
  if not found then
    raise exception 'Knowledge object is unavailable';
  end if;

  select concept.retailer_id into v_concept_retailer_id
  from public.metadata_concepts as concept
  where concept.id = new.concept_id
    and concept.deleted_at is null;
  if not found then
    raise exception 'Metadata concept is unavailable';
  end if;

  if v_object_retailer_id is null then
    if v_concept_retailer_id is not null then
      raise exception 'Canonical knowledge may join canonical concepts only';
    end if;
  elsif v_concept_retailer_id is not null
    and v_concept_retailer_id <> v_object_retailer_id then
    raise exception 'Knowledge concept join does not belong to the retailer';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_knowledge_object_concept_tenancy() from public;

create trigger enforce_knowledge_object_concept_tenancy_on_write
  before insert or update on public.knowledge_object_concepts
  for each row execute function public.enforce_knowledge_object_concept_tenancy();

create table public.knowledge_object_relations (
  id uuid primary key default gen_random_uuid(),
  source_knowledge_object_id uuid not null
    references public.knowledge_objects (id) on delete cascade,
  target_knowledge_object_id uuid not null
    references public.knowledge_objects (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (source_knowledge_object_id <> target_knowledge_object_id)
);

create unique index knowledge_object_relations_active_uidx
  on public.knowledge_object_relations (
    source_knowledge_object_id,
    target_knowledge_object_id
  )
  where deleted_at is null;

create index knowledge_object_relations_target_idx
  on public.knowledge_object_relations (target_knowledge_object_id)
  where deleted_at is null;

create trigger set_knowledge_object_relations_updated_at
  before update on public.knowledge_object_relations
  for each row execute function public.set_updated_at();

create or replace function public.enforce_knowledge_object_relation_tenancy()
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

  select knowledge_object.retailer_id into v_source_retailer_id
  from public.knowledge_objects as knowledge_object
  where knowledge_object.id = new.source_knowledge_object_id
    and knowledge_object.deleted_at is null;
  if not found then
    raise exception 'Source knowledge object is unavailable';
  end if;

  select knowledge_object.retailer_id into v_target_retailer_id
  from public.knowledge_objects as knowledge_object
  where knowledge_object.id = new.target_knowledge_object_id
    and knowledge_object.deleted_at is null;
  if not found then
    raise exception 'Target knowledge object is unavailable';
  end if;

  if v_source_retailer_id is not null
    and v_target_retailer_id is not null
    and v_source_retailer_id <> v_target_retailer_id then
    raise exception 'Knowledge relation crosses retailer boundaries';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_knowledge_object_relation_tenancy() from public;

create trigger enforce_knowledge_object_relation_tenancy_on_write
  before insert or update on public.knowledge_object_relations
  for each row execute function public.enforce_knowledge_object_relation_tenancy();

create table public.retailer_knowledge_overrides (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  knowledge_object_id uuid not null
    references public.knowledge_objects (id) on delete restrict,
  display_title text check (
    display_title is null
    or length(btrim(display_title)) between 1 and 200
  ),
  summary_override text check (
    summary_override is null
    or length(btrim(summary_override)) between 1 and 2000
  ),
  image_url_override text,
  is_hidden boolean not null default false,
  is_pinned boolean not null default false,
  priority_override integer check (priority_override between -1000 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index retailer_knowledge_overrides_active_uidx
  on public.retailer_knowledge_overrides (retailer_id, knowledge_object_id);

create index retailer_knowledge_overrides_object_idx
  on public.retailer_knowledge_overrides (knowledge_object_id, retailer_id)
  where deleted_at is null;

create trigger set_retailer_knowledge_overrides_updated_at
  before update on public.retailer_knowledge_overrides
  for each row execute function public.set_updated_at();

create or replace function public.enforce_retailer_knowledge_override_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_object_retailer_id uuid;
begin
  if tg_op = 'UPDATE'
    and new.deleted_at is not null
    and old.deleted_at is null then
    return new;
  end if;

  select knowledge_object.retailer_id into v_object_retailer_id
  from public.knowledge_objects as knowledge_object
  where knowledge_object.id = new.knowledge_object_id
    and knowledge_object.deleted_at is null;
  if not found then
    raise exception 'Knowledge object is unavailable';
  end if;

  if v_object_retailer_id is not null
    and v_object_retailer_id <> new.retailer_id then
    raise exception 'Knowledge override object does not belong to the retailer';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_retailer_knowledge_override_tenancy() from public;

create trigger enforce_retailer_knowledge_override_tenancy_on_write
  before insert or update on public.retailer_knowledge_overrides
  for each row
  execute function public.enforce_retailer_knowledge_override_tenancy();

-- Visibility helper for join/relation policies: staff may see joins for
-- canonical objects or objects owned by their retailer.
create or replace function public.can_read_knowledge_object(p_object_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.knowledge_objects as knowledge_object
    where knowledge_object.id = p_object_id
      and knowledge_object.deleted_at is null
      and (
        (select public.is_platform_staff())
        or (
          (
            knowledge_object.retailer_id is null
            or knowledge_object.retailer_id = (select public.current_retailer_id())
          )
          and (select public.current_retailer_role()) in (
            'read_only',
            'production_staff',
            'sales_associate',
            'manager',
            'admin',
            'owner'
          )
        )
      )
  );
$$;

revoke all on function public.can_read_knowledge_object(uuid) from public;
grant execute on function public.can_read_knowledge_object(uuid)
  to authenticated, service_role;

create or replace function public.can_write_knowledge_object(p_object_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.knowledge_objects as knowledge_object
    where knowledge_object.id = p_object_id
      and knowledge_object.deleted_at is null
      and (
        (select public.is_platform_staff())
        or (
          knowledge_object.retailer_id = (select public.current_retailer_id())
          and (select public.current_retailer_role()) in (
            'manager',
            'admin',
            'owner'
          )
        )
      )
  );
$$;

revoke all on function public.can_write_knowledge_object(uuid) from public;
grant execute on function public.can_write_knowledge_object(uuid)
  to authenticated, service_role;

alter table public.knowledge_objects enable row level security;
alter table public.knowledge_object_concepts enable row level security;
alter table public.knowledge_object_relations enable row level security;
alter table public.retailer_knowledge_overrides enable row level security;

create policy "authorized staff can read visible knowledge objects"
  on public.knowledge_objects for select to authenticated
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

create policy "authorized staff can insert knowledge objects"
  on public.knowledge_objects for insert to authenticated
  with check (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "authorized staff can update knowledge objects"
  on public.knowledge_objects for update to authenticated
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

create policy "authorized staff can delete knowledge objects"
  on public.knowledge_objects for delete to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "authorized staff can read knowledge object concepts"
  on public.knowledge_object_concepts for select to authenticated
  using ((select public.can_read_knowledge_object(knowledge_object_id)));

create policy "authorized staff can insert knowledge object concepts"
  on public.knowledge_object_concepts for insert to authenticated
  with check ((select public.can_write_knowledge_object(knowledge_object_id)));

create policy "authorized staff can update knowledge object concepts"
  on public.knowledge_object_concepts for update to authenticated
  using ((select public.can_write_knowledge_object(knowledge_object_id)))
  with check ((select public.can_write_knowledge_object(knowledge_object_id)));

create policy "authorized staff can delete knowledge object concepts"
  on public.knowledge_object_concepts for delete to authenticated
  using ((select public.can_write_knowledge_object(knowledge_object_id)));

create policy "authorized staff can read knowledge object relations"
  on public.knowledge_object_relations for select to authenticated
  using (
    (select public.can_read_knowledge_object(source_knowledge_object_id))
    and (select public.can_read_knowledge_object(target_knowledge_object_id))
  );

create policy "authorized staff can insert knowledge object relations"
  on public.knowledge_object_relations for insert to authenticated
  with check (
    (select public.can_read_knowledge_object(source_knowledge_object_id))
    and (select public.can_read_knowledge_object(target_knowledge_object_id))
    and (
      (select public.is_platform_staff())
      or (select public.can_write_knowledge_object(source_knowledge_object_id))
      or (select public.can_write_knowledge_object(target_knowledge_object_id))
    )
  );

create policy "authorized staff can update knowledge object relations"
  on public.knowledge_object_relations for update to authenticated
  using (
    (select public.can_read_knowledge_object(source_knowledge_object_id))
    and (select public.can_read_knowledge_object(target_knowledge_object_id))
    and (
      (select public.is_platform_staff())
      or (select public.can_write_knowledge_object(source_knowledge_object_id))
      or (select public.can_write_knowledge_object(target_knowledge_object_id))
    )
  )
  with check (
    (select public.can_read_knowledge_object(source_knowledge_object_id))
    and (select public.can_read_knowledge_object(target_knowledge_object_id))
    and (
      (select public.is_platform_staff())
      or (select public.can_write_knowledge_object(source_knowledge_object_id))
      or (select public.can_write_knowledge_object(target_knowledge_object_id))
    )
  );

create policy "authorized staff can delete knowledge object relations"
  on public.knowledge_object_relations for delete to authenticated
  using (
    (select public.can_read_knowledge_object(source_knowledge_object_id))
    and (select public.can_read_knowledge_object(target_knowledge_object_id))
    and (
      (select public.is_platform_staff())
      or (select public.can_write_knowledge_object(source_knowledge_object_id))
      or (select public.can_write_knowledge_object(target_knowledge_object_id))
    )
  );

create policy "authorized staff can read tenant knowledge overrides"
  on public.retailer_knowledge_overrides for select to authenticated
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

create policy "authorized staff can insert tenant knowledge overrides"
  on public.retailer_knowledge_overrides for insert to authenticated
  with check (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "authorized staff can update tenant knowledge overrides"
  on public.retailer_knowledge_overrides for update to authenticated
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

create policy "authorized staff can delete tenant knowledge overrides"
  on public.retailer_knowledge_overrides for delete to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

revoke all on table
  public.knowledge_objects,
  public.knowledge_object_concepts,
  public.knowledge_object_relations,
  public.retailer_knowledge_overrides
from anon;

grant select, insert, update, delete on table
  public.knowledge_objects,
  public.knowledge_object_concepts,
  public.knowledge_object_relations,
  public.retailer_knowledge_overrides
to authenticated;

grant select, insert, update, delete on table
  public.knowledge_objects,
  public.knowledge_object_concepts,
  public.knowledge_object_relations,
  public.retailer_knowledge_overrides
to service_role;

comment on table public.knowledge_objects is
  'PAON canonical (retailer_id null) and retailer-owned reusable education objects; ADR-060.';
comment on table public.knowledge_object_concepts is
  'Concept joins that gate knowledge eligibility through accepted metadata.';
comment on table public.knowledge_object_relations is
  'Directed relations between knowledge objects within a visible ownership set.';
comment on table public.retailer_knowledge_overrides is
  'Tenant hide/rename/summary/priority/pin controls that never mutate canonical copy.';
