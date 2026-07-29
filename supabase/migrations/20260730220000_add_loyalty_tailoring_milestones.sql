-- PHASE 5.2 — Tailoring milestones and premium rewards (MILE-001, MILE-002).
-- Eligibility derives from authoritative orders + accepted metadata.
-- Awards write only through loyalty_ledger_entries (earn_bonus / adjustment_manual).
-- recognition rows are audit projections, never a second balance.

create type public.loyalty_milestone_kind as enum (
  'first_commission',
  'repeat_order',
  'new_category',
  'premium_construction',
  'advanced_fabric',
  'custom'
);

create type public.loyalty_milestone_award_status as enum (
  'awarded',
  'reversed'
);

create table if not exists public.loyalty_milestone_definitions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  kind public.loyalty_milestone_kind not null,
  custom_key text check (
    custom_key is null
    or (
      char_length(btrim(custom_key)) between 1 and 80
      and custom_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    )
  ),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  explanation text not null check (char_length(btrim(explanation)) between 1 and 500),
  points integer not null check (points > 0 and points <= 1000),
  match_concept_ids uuid[] not null default '{}'::uuid[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loyalty_milestone_definitions_custom_key_ck check (
    (kind = 'custom' and custom_key is not null)
    or (kind <> 'custom' and custom_key is null)
  ),
  constraint loyalty_milestone_definitions_custom_concepts_ck check (
    kind <> 'custom'
    or cardinality(match_concept_ids) > 0
    or active = false
  )
);

create unique index loyalty_milestone_definitions_builtin_uidx
  on public.loyalty_milestone_definitions (retailer_id, kind)
  where kind <> 'custom';

create unique index loyalty_milestone_definitions_custom_uidx
  on public.loyalty_milestone_definitions (retailer_id, custom_key)
  where kind = 'custom' and custom_key is not null;

create index loyalty_milestone_definitions_retailer_idx
  on public.loyalty_milestone_definitions (retailer_id, active);

create trigger set_loyalty_milestone_definitions_updated_at
  before update on public.loyalty_milestone_definitions
  for each row execute function public.set_updated_at();

create table if not exists public.loyalty_milestone_awards (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  loyalty_account_id uuid not null
    references public.loyalty_accounts (id) on delete cascade,
  definition_id uuid
    references public.loyalty_milestone_definitions (id) on delete set null,
  kind public.loyalty_milestone_kind not null,
  idempotency_key text not null check (
    char_length(btrim(idempotency_key)) between 1 and 200
  ),
  related_order_id uuid references public.orders (id) on delete set null,
  related_concept_id uuid references public.metadata_concepts (id)
    on delete set null,
  points integer not null check (points > 0 and points <= 1000),
  status public.loyalty_milestone_award_status not null default 'awarded',
  loyalty_ledger_entry_id uuid
    references public.loyalty_ledger_entries (id) on delete set null,
  reverse_ledger_entry_id uuid
    references public.loyalty_ledger_entries (id) on delete set null,
  label text not null check (char_length(btrim(label)) between 1 and 120),
  explanation text not null check (char_length(btrim(explanation)) between 1 and 500),
  awarded_at timestamptz not null default now(),
  reversed_at timestamptz,
  constraint loyalty_milestone_awards_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint loyalty_milestone_awards_reverse_ck check (
    (
      status = 'awarded'
      and reversed_at is null
      and reverse_ledger_entry_id is null
    )
    or (
      status = 'reversed'
      and reversed_at is not null
    )
  ),
  constraint loyalty_milestone_awards_idempotency_uidx
    unique (loyalty_account_id, kind, idempotency_key)
);

create index loyalty_milestone_awards_customer_idx
  on public.loyalty_milestone_awards (customer_id, awarded_at desc);

create index loyalty_milestone_awards_order_idx
  on public.loyalty_milestone_awards (related_order_id)
  where related_order_id is not null;

comment on table public.loyalty_milestone_definitions is
  'Retailer-configured tailoring milestone rules; awards use the loyalty ledger (PHASE 5.2).';
comment on table public.loyalty_milestone_awards is
  'Auditable milestone recognition projecting into loyalty_ledger_entries — never a second balance (PHASE 5.2).';

alter table public.loyalty_milestone_definitions enable row level security;
alter table public.loyalty_milestone_awards enable row level security;

revoke all on table public.loyalty_milestone_definitions from anon;
revoke all on table public.loyalty_milestone_awards from anon;

create policy "platform manages loyalty milestone definitions"
  on public.loyalty_milestone_definitions for all to authenticated
  using ((select public.is_platform_staff()))
  with check ((select public.is_platform_staff()));

create policy "retailer reads loyalty milestone definitions"
  on public.loyalty_milestone_definitions for select to authenticated
  using (retailer_id = (select public.current_retailer_id()));

create policy "retailer managers manage loyalty milestone definitions"
  on public.loyalty_milestone_definitions for all to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
  )
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
  );

create policy "customers read tenant loyalty milestone definitions"
  on public.loyalty_milestone_definitions for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.retailer_id = loyalty_milestone_definitions.retailer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "platform manages loyalty milestone awards"
  on public.loyalty_milestone_awards for all to authenticated
  using ((select public.is_platform_staff()))
  with check ((select public.is_platform_staff()));

create policy "retailer reads loyalty milestone awards"
  on public.loyalty_milestone_awards for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner', 'read_only',
      'production_staff'
    )
  );

create policy "customers read own loyalty milestone awards"
  on public.loyalty_milestone_awards for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = loyalty_milestone_awards.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

grant select, insert, update, delete on table public.loyalty_milestone_definitions
  to authenticated, service_role;
grant select on table public.loyalty_milestone_awards
  to authenticated, service_role;
grant all on table public.loyalty_milestone_awards to service_role;

-- ---------------------------------------------------------------------------
-- Seed built-in definitions for a retailer
-- ---------------------------------------------------------------------------

create or replace function public.ensure_loyalty_milestone_definitions(
  p_retailer_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.loyalty_milestone_definitions (
    retailer_id, kind, label, explanation, points
  )
  select p_retailer_id, v.kind::public.loyalty_milestone_kind, v.label, v.explanation, v.points
  from (
    values
      (
        'first_commission',
        'First commission',
        'Recognised for your first made-to-order commission with this house.',
        250
      ),
      (
        'repeat_order',
        'Return to the house',
        'Recognised for returning to commission with this house.',
        150
      ),
      (
        'new_category',
        'New category explored',
        'Recognised for exploring a new garment category.',
        200
      ),
      (
        'premium_construction',
        'Full-canvas craft',
        'Recognised for choosing premium construction.',
        300
      ),
      (
        'advanced_fabric',
        'Advanced cloth',
        'Recognised for commissioning advanced cloth.',
        300
      )
  ) as v(kind, label, explanation, points)
  where not exists (
    select 1
    from public.loyalty_milestone_definitions existing
    where existing.retailer_id = p_retailer_id
      and existing.kind = v.kind::public.loyalty_milestone_kind
  );
end;
$$;

revoke all on function public.ensure_loyalty_milestone_definitions(uuid) from public;
grant execute on function public.ensure_loyalty_milestone_definitions(uuid)
  to authenticated, service_role;

-- Seed for existing programmes
insert into public.loyalty_milestone_definitions (
  retailer_id, kind, label, explanation, points
)
select
  p.retailer_id,
  v.kind::public.loyalty_milestone_kind,
  v.label,
  v.explanation,
  v.points
from public.loyalty_programs p
cross join (
  values
    (
      'first_commission',
      'First commission',
      'Recognised for your first made-to-order commission with this house.',
      250
    ),
    (
      'repeat_order',
      'Return to the house',
      'Recognised for returning to commission with this house.',
      150
    ),
    (
      'new_category',
      'New category explored',
      'Recognised for exploring a new garment category.',
      200
    ),
    (
      'premium_construction',
      'Full-canvas craft',
      'Recognised for choosing premium construction.',
      300
    ),
    (
      'advanced_fabric',
      'Advanced cloth',
      'Recognised for commissioning advanced cloth.',
      300
    )
) as v(kind, label, explanation, points)
where p.deleted_at is null
  and not exists (
    select 1
    from public.loyalty_milestone_definitions existing
    where existing.retailer_id = p.retailer_id
      and existing.kind = v.kind::public.loyalty_milestone_kind
  );

-- ---------------------------------------------------------------------------
-- Helpers: concept matching
-- ---------------------------------------------------------------------------

create or replace function public.loyalty_milestone_slug_matches(
  p_slug text,
  p_hints text[]
) returns boolean
language sql
immutable
as $$
  select exists (
    select 1
    from unnest(p_hints) as hint
    where replace(lower(p_slug), '_', '-') = replace(lower(hint), '_', '-')
       or replace(lower(p_slug), '_', '-') like '%' || replace(lower(hint), '_', '-') || '%'
  );
$$;

revoke all on function public.loyalty_milestone_slug_matches(text, text[]) from public;

-- ---------------------------------------------------------------------------
-- Core sync RPC — award + reverse against the loyalty ledger
-- ---------------------------------------------------------------------------

create or replace function public.sync_loyalty_milestones_for_order(
  p_order_id uuid
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_account public.loyalty_accounts%rowtype;
  v_program public.loyalty_programs%rowtype;
  v_awarded integer := 0;
  v_def public.loyalty_milestone_definitions%rowtype;
  v_points integer;
  v_ledger_id uuid;
  v_award_id uuid;
  v_prior_commission boolean;
  v_qualifying_count integer;
  v_concept record;
  v_custom public.loyalty_milestone_definitions%rowtype;
  v_award public.loyalty_milestone_awards%rowtype;
  v_reverse_ledger_id uuid;
  v_peer_concept_id uuid;
  v_peer_concept_name text;
  v_premium_hints text[] := array[
    'full-canvas', 'fullcanvas', 'hand-canvas', 'handcanvas', 'floating-canvas'
  ];
  v_fabric_hints text[] := array[
    'cashmere', 'vicuna', 'guanaco', 'super-150', 'super150',
    'super-180', 'super180', 'lotus', 'qiviuk'
  ];
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.deleted_at is not null then
    return 0;
  end if;

  select * into v_program
  from public.loyalty_programs
  where retailer_id = v_order.retailer_id
    and enabled
    and deleted_at is null;
  if not found then
    return 0;
  end if;

  perform public.ensure_loyalty_milestone_definitions(v_order.retailer_id);

  insert into public.loyalty_accounts (retailer_id, customer_id)
  values (v_order.retailer_id, v_order.customer_id)
  on conflict (retailer_id, customer_id) do update
    set updated_at = now()
  returning * into v_account;

  select * into v_account
  from public.loyalty_accounts
  where id = v_account.id
  for update;

  -- Corrections / refunds: reverse awards tied to this order
  if v_order.status in ('canceled', 'refunded') then
    for v_award in
      select *
      from public.loyalty_milestone_awards
      where loyalty_account_id = v_account.id
        and related_order_id = v_order.id
        and status = 'awarded'
      for update
    loop
      insert into public.loyalty_ledger_entries (
        loyalty_account_id, type, points, related_order_id, note
      ) values (
        v_account.id,
        'adjustment_manual',
        -v_award.points,
        v_order.id,
        'Milestone correction: ' || v_award.idempotency_key
      )
      returning id into v_reverse_ledger_id;

      update public.loyalty_accounts
      set
        points_balance = greatest(0, points_balance - v_award.points),
        lifetime_points = greatest(0, lifetime_points - v_award.points)
      where id = v_account.id;

      update public.loyalty_milestone_awards
      set
        status = 'reversed',
        reversed_at = now(),
        reverse_ledger_entry_id = v_reverse_ledger_id
      where id = v_award.id;

      v_awarded := v_awarded + 1;
    end loop;
    return v_awarded;
  end if;

  if v_order.status not in ('delivered', 'completed') then
    return 0;
  end if;

  -- first_commission
  select * into v_def
  from public.loyalty_milestone_definitions
  where retailer_id = v_order.retailer_id
    and kind = 'first_commission'
    and active
  limit 1;

  if found then
    select exists (
      select 1
      from public.orders o
      join public.order_lines ol on ol.order_id = o.id
      where o.customer_id = v_order.customer_id
        and o.retailer_id = v_order.retailer_id
        and o.id <> v_order.id
        and o.deleted_at is null
        and o.status in ('delivered', 'completed')
        and ol.requires_production
    ) into v_prior_commission;

    if not v_prior_commission
      and exists (
        select 1 from public.order_lines ol
        where ol.order_id = v_order.id and ol.requires_production
      )
      and not exists (
        select 1 from public.loyalty_milestone_awards a
        where a.loyalty_account_id = v_account.id
          and a.kind = 'first_commission'
          and a.idempotency_key = 'first_commission'
          and a.status = 'awarded'
      )
    then
      v_points := least(v_def.points, 1000);
      insert into public.loyalty_ledger_entries (
        loyalty_account_id, type, points, related_order_id, note
      ) values (
        v_account.id, 'earn_bonus', v_points, v_order.id,
        'Milestone: first_commission'
      )
      returning id into v_ledger_id;

      update public.loyalty_accounts
      set points_balance = points_balance + v_points,
          lifetime_points = lifetime_points + v_points
      where id = v_account.id;

      insert into public.loyalty_milestone_awards (
        retailer_id, customer_id, loyalty_account_id, definition_id,
        kind, idempotency_key, related_order_id, points,
        loyalty_ledger_entry_id, label, explanation
      ) values (
        v_order.retailer_id, v_order.customer_id, v_account.id, v_def.id,
        'first_commission', 'first_commission', v_order.id, v_points,
        v_ledger_id, v_def.label, v_def.explanation
      )
      on conflict (loyalty_account_id, kind, idempotency_key) do nothing;

      v_awarded := v_awarded + 1;
    end if;
  end if;

  -- repeat_order
  select * into v_def
  from public.loyalty_milestone_definitions
  where retailer_id = v_order.retailer_id
    and kind = 'repeat_order'
    and active
  limit 1;

  if found then
    select count(*) into v_qualifying_count
    from public.orders o
    where o.customer_id = v_order.customer_id
      and o.retailer_id = v_order.retailer_id
      and o.deleted_at is null
      and o.status in ('delivered', 'completed');

    if v_qualifying_count >= 2
      and not exists (
        select 1 from public.loyalty_milestone_awards a
        where a.loyalty_account_id = v_account.id
          and a.kind = 'repeat_order'
          and a.idempotency_key = 'repeat_order'
          and a.status = 'awarded'
      )
    then
      v_points := least(v_def.points, 1000);
      insert into public.loyalty_ledger_entries (
        loyalty_account_id, type, points, related_order_id, note
      ) values (
        v_account.id, 'earn_bonus', v_points, v_order.id,
        'Milestone: repeat_order'
      )
      returning id into v_ledger_id;

      update public.loyalty_accounts
      set points_balance = points_balance + v_points,
          lifetime_points = lifetime_points + v_points
      where id = v_account.id;

      insert into public.loyalty_milestone_awards (
        retailer_id, customer_id, loyalty_account_id, definition_id,
        kind, idempotency_key, related_order_id, points,
        loyalty_ledger_entry_id, label, explanation
      ) values (
        v_order.retailer_id, v_order.customer_id, v_account.id, v_def.id,
        'repeat_order', 'repeat_order', v_order.id, v_points,
        v_ledger_id, v_def.label, v_def.explanation
      )
      on conflict (loyalty_account_id, kind, idempotency_key) do nothing;

      v_awarded := v_awarded + 1;
    end if;
  end if;

  -- new_category
  select * into v_def
  from public.loyalty_milestone_definitions
  where retailer_id = v_order.retailer_id
    and kind = 'new_category'
    and active
  limit 1;

  if found then
    for v_concept in
      select distinct c.id as concept_id, c.canonical_name
      from public.order_lines ol
      join public.product_variants pv on pv.id = ol.product_variant_id
      join public.entity_metadata_assignments ema
        on ema.target_type = 'product'
        and ema.target_id = pv.product_id
        and ema.retailer_id = v_order.retailer_id
        and ema.review_status = 'accepted'
        and ema.deleted_at is null
      join public.metadata_concepts c
        on c.id = ema.concept_id
        and c.kind = 'garment_type'
        and c.deleted_at is null
      where ol.order_id = v_order.id
        and not exists (
          select 1
          from public.orders o2
          join public.order_lines ol2 on ol2.order_id = o2.id
          join public.product_variants pv2 on pv2.id = ol2.product_variant_id
          join public.entity_metadata_assignments ema2
            on ema2.target_type = 'product'
            and ema2.target_id = pv2.product_id
            and ema2.retailer_id = v_order.retailer_id
            and ema2.review_status = 'accepted'
            and ema2.deleted_at is null
            and ema2.concept_id = c.id
          where o2.customer_id = v_order.customer_id
            and o2.retailer_id = v_order.retailer_id
            and o2.id <> v_order.id
            and o2.deleted_at is null
            and o2.status in ('delivered', 'completed')
        )
        and not exists (
          select 1 from public.loyalty_milestone_awards a
          where a.loyalty_account_id = v_account.id
            and a.kind = 'new_category'
            and a.idempotency_key = 'new_category:' || c.id::text
            and a.status = 'awarded'
        )
    loop
      v_points := least(v_def.points, 1000);
      insert into public.loyalty_ledger_entries (
        loyalty_account_id, type, points, related_order_id, note
      ) values (
        v_account.id, 'earn_bonus', v_points, v_order.id,
        'Milestone: new_category:' || v_concept.concept_id::text
      )
      returning id into v_ledger_id;

      update public.loyalty_accounts
      set points_balance = points_balance + v_points,
          lifetime_points = lifetime_points + v_points
      where id = v_account.id;

      insert into public.loyalty_milestone_awards (
        retailer_id, customer_id, loyalty_account_id, definition_id,
        kind, idempotency_key, related_order_id, related_concept_id, points,
        loyalty_ledger_entry_id, label, explanation
      ) values (
        v_order.retailer_id, v_order.customer_id, v_account.id, v_def.id,
        'new_category', 'new_category:' || v_concept.concept_id::text,
        v_order.id, v_concept.concept_id, v_points, v_ledger_id,
        v_def.label,
        v_def.explanation || ' (' || v_concept.canonical_name || ')'
      )
      on conflict (loyalty_account_id, kind, idempotency_key) do nothing;

      v_awarded := v_awarded + 1;
    end loop;
  end if;

  -- premium_construction
  select * into v_def
  from public.loyalty_milestone_definitions
  where retailer_id = v_order.retailer_id
    and kind = 'premium_construction'
    and active
  limit 1;

  if found then
    for v_concept in
      select distinct c.id as concept_id, c.canonical_name
      from public.order_lines ol
      join public.product_variants pv on pv.id = ol.product_variant_id
      join public.entity_metadata_assignments ema
        on ema.target_type = 'product'
        and ema.target_id = pv.product_id
        and ema.retailer_id = v_order.retailer_id
        and ema.review_status = 'accepted'
        and ema.deleted_at is null
      join public.metadata_concepts c
        on c.id = ema.concept_id
        and c.kind = 'construction'
        and c.deleted_at is null
      where ol.order_id = v_order.id
        and (
          (
            cardinality(v_def.match_concept_ids) > 0
            and c.id = any (v_def.match_concept_ids)
          )
          or (
            cardinality(v_def.match_concept_ids) = 0
            and public.loyalty_milestone_slug_matches(c.slug, v_premium_hints)
          )
        )
        and not exists (
          select 1 from public.loyalty_milestone_awards a
          where a.loyalty_account_id = v_account.id
            and a.kind = 'premium_construction'
            and a.idempotency_key = 'premium_construction:' || c.id::text
            and a.status = 'awarded'
        )
    loop
      v_points := least(v_def.points, 1000);
      insert into public.loyalty_ledger_entries (
        loyalty_account_id, type, points, related_order_id, note
      ) values (
        v_account.id, 'earn_bonus', v_points, v_order.id,
        'Milestone: premium_construction:' || v_concept.concept_id::text
      )
      returning id into v_ledger_id;

      update public.loyalty_accounts
      set points_balance = points_balance + v_points,
          lifetime_points = lifetime_points + v_points
      where id = v_account.id;

      insert into public.loyalty_milestone_awards (
        retailer_id, customer_id, loyalty_account_id, definition_id,
        kind, idempotency_key, related_order_id, related_concept_id, points,
        loyalty_ledger_entry_id, label, explanation
      ) values (
        v_order.retailer_id, v_order.customer_id, v_account.id, v_def.id,
        'premium_construction',
        'premium_construction:' || v_concept.concept_id::text,
        v_order.id, v_concept.concept_id, v_points, v_ledger_id,
        v_def.label,
        v_def.explanation || ' (' || v_concept.canonical_name || ')'
      )
      on conflict (loyalty_account_id, kind, idempotency_key) do nothing;

      v_awarded := v_awarded + 1;
    end loop;
  end if;

  -- advanced_fabric (assignments + fabric composition fibres)
  select * into v_def
  from public.loyalty_milestone_definitions
  where retailer_id = v_order.retailer_id
    and kind = 'advanced_fabric'
    and active
  limit 1;

  if found then
    for v_concept in
      select distinct c.id as concept_id, c.canonical_name
      from public.order_lines ol
      join public.product_variants pv on pv.id = ol.product_variant_id
      left join public.entity_metadata_assignments ema
        on ema.target_type = 'product'
        and ema.target_id = pv.product_id
        and ema.retailer_id = v_order.retailer_id
        and ema.review_status = 'accepted'
        and ema.deleted_at is null
      left join public.product_fabric_profiles pfp
        on pfp.product_id = pv.product_id
        and pfp.deleted_at is null
        and (
          pfp.product_variant_id is null
          or pfp.product_variant_id = pv.id
        )
      left join public.product_fabric_composition pfc
        on pfc.profile_id = pfp.id
      join public.metadata_concepts c
        on c.deleted_at is null
        and c.kind in ('fibre', 'fabric')
        and (
          c.id = ema.concept_id
          or c.id = pfc.fibre_concept_id
        )
      where ol.order_id = v_order.id
        and (
          (
            cardinality(v_def.match_concept_ids) > 0
            and c.id = any (v_def.match_concept_ids)
          )
          or (
            cardinality(v_def.match_concept_ids) = 0
            and public.loyalty_milestone_slug_matches(c.slug, v_fabric_hints)
          )
        )
        and not exists (
          select 1 from public.loyalty_milestone_awards a
          where a.loyalty_account_id = v_account.id
            and a.kind = 'advanced_fabric'
            and a.idempotency_key = 'advanced_fabric:' || c.id::text
            and a.status = 'awarded'
        )
    loop
      v_points := least(v_def.points, 1000);
      insert into public.loyalty_ledger_entries (
        loyalty_account_id, type, points, related_order_id, note
      ) values (
        v_account.id, 'earn_bonus', v_points, v_order.id,
        'Milestone: advanced_fabric:' || v_concept.concept_id::text
      )
      returning id into v_ledger_id;

      update public.loyalty_accounts
      set points_balance = points_balance + v_points,
          lifetime_points = lifetime_points + v_points
      where id = v_account.id;

      insert into public.loyalty_milestone_awards (
        retailer_id, customer_id, loyalty_account_id, definition_id,
        kind, idempotency_key, related_order_id, related_concept_id, points,
        loyalty_ledger_entry_id, label, explanation
      ) values (
        v_order.retailer_id, v_order.customer_id, v_account.id, v_def.id,
        'advanced_fabric',
        'advanced_fabric:' || v_concept.concept_id::text,
        v_order.id, v_concept.concept_id, v_points, v_ledger_id,
        v_def.label,
        v_def.explanation || ' (' || v_concept.canonical_name || ')'
      )
      on conflict (loyalty_account_id, kind, idempotency_key) do nothing;

      v_awarded := v_awarded + 1;
    end loop;
  end if;

  -- configured peers (custom)
  for v_custom in
    select *
    from public.loyalty_milestone_definitions
    where retailer_id = v_order.retailer_id
      and kind = 'custom'
      and active
      and cardinality(match_concept_ids) > 0
  loop
    if exists (
      select 1 from public.loyalty_milestone_awards a
      where a.loyalty_account_id = v_account.id
        and a.kind = 'custom'
        and a.idempotency_key = 'custom:' || v_custom.custom_key
        and a.status = 'awarded'
    ) then
      continue;
    end if;

    v_peer_concept_id := null;
    v_peer_concept_name := null;
    select c.id, c.canonical_name
    into v_peer_concept_id, v_peer_concept_name
    from public.order_lines ol
    join public.product_variants pv on pv.id = ol.product_variant_id
    left join public.entity_metadata_assignments ema
      on ema.target_type = 'product'
      and ema.target_id = pv.product_id
      and ema.retailer_id = v_order.retailer_id
      and ema.review_status = 'accepted'
      and ema.deleted_at is null
    left join public.product_fabric_profiles pfp
      on pfp.product_id = pv.product_id
      and pfp.deleted_at is null
    left join public.product_fabric_composition pfc
      on pfc.profile_id = pfp.id
    join public.metadata_concepts c
      on c.deleted_at is null
      and (
        c.id = ema.concept_id
        or c.id = pfc.fibre_concept_id
      )
      and c.id = any (v_custom.match_concept_ids)
    where ol.order_id = v_order.id
    limit 1;

    if v_peer_concept_id is not null then
      v_points := least(v_custom.points, 1000);
      insert into public.loyalty_ledger_entries (
        loyalty_account_id, type, points, related_order_id, note
      ) values (
        v_account.id, 'earn_bonus', v_points, v_order.id,
        'Milestone: custom:' || v_custom.custom_key
      )
      returning id into v_ledger_id;

      update public.loyalty_accounts
      set points_balance = points_balance + v_points,
          lifetime_points = lifetime_points + v_points
      where id = v_account.id;

      insert into public.loyalty_milestone_awards (
        retailer_id, customer_id, loyalty_account_id, definition_id,
        kind, idempotency_key, related_order_id, related_concept_id, points,
        loyalty_ledger_entry_id, label, explanation
      ) values (
        v_order.retailer_id, v_order.customer_id, v_account.id, v_custom.id,
        'custom', 'custom:' || v_custom.custom_key,
        v_order.id, v_peer_concept_id, v_points, v_ledger_id,
        v_custom.label, v_custom.explanation
      )
      on conflict (loyalty_account_id, kind, idempotency_key) do nothing;

      v_awarded := v_awarded + 1;
    end if;
  end loop;

  return v_awarded;
end;
$$;

revoke all on function public.sync_loyalty_milestones_for_order(uuid) from public;
grant execute on function public.sync_loyalty_milestones_for_order(uuid)
  to authenticated, service_role;

create or replace function public.sync_loyalty_milestones_after_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    perform public.sync_loyalty_milestones_for_order(new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.sync_loyalty_milestones_after_order_status() from public;

drop trigger if exists sync_loyalty_milestones_after_order_status on public.orders;
create trigger sync_loyalty_milestones_after_order_status
  after update of status on public.orders
  for each row execute function public.sync_loyalty_milestones_after_order_status();

-- Also seed definitions when a loyalty account is ensured
create or replace function public.ensure_my_loyalty_account(p_retailer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_account_id uuid;
begin
  select id into v_customer_id
  from public.customers
  where retailer_id = p_retailer_id
    and user_id = auth.uid()
    and deleted_at is null;
  if v_customer_id is null then
    raise exception 'No customer relationship exists for this retailer';
  end if;
  insert into public.loyalty_programs (retailer_id)
  values (p_retailer_id)
  on conflict (retailer_id) do nothing;
  perform public.ensure_loyalty_milestone_definitions(p_retailer_id);
  insert into public.loyalty_accounts (retailer_id, customer_id)
  values (p_retailer_id, v_customer_id)
  on conflict (retailer_id, customer_id) do update
    set updated_at = public.loyalty_accounts.updated_at
  returning id into v_account_id;
  return v_account_id;
end;
$$;
