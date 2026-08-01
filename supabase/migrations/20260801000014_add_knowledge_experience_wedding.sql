-- PHASE 16.1-16.5: content library and consultancy, media incubation,
-- vertical-pack framework, instrumented store, and the Moonstruck wedding
-- pack.
--
-- 16.5 does NOT create a party or member table. `public.wedding_parties`
-- and `public.wedding_party_members` (2026-07-19) already exist with roles,
-- invites, fitting states and RLS, and the item's owner boundary says
-- "never create a second party model". Everything here hangs off those
-- rows by foreign key. A test asserts no second party table appears.
--
-- 16.4's store observation table has no `staff_id` column and no biometric
-- template column, and a test asserts both absences. A zone sensor that
-- can report which advisor stood where becomes a productivity monitor the
-- day someone asks it to, and that is a named non-goal.
--
-- 16.1's `knowledge_articles` requires a provenance and cannot be published
-- while AI-authored and unapproved: the CHECK does the work that the
-- "no unreviewed AI publication" non-goal describes.

create table if not exists public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  audience text not null check (
    audience in ('customer', 'staff', 'owner', 'media')
  ),
  title text not null check (char_length(btrim(title)) between 3 and 300),
  body text not null check (char_length(btrim(body)) between 20 and 200000),
  -- NOT NULL so an AI draft cannot be laundered in by omitting it.
  provenance text not null check (
    provenance in ('human_authored', 'ai_assisted', 'ai_generated', 'licensed_third_party')
  ),
  review_state text not null default 'draft' check (
    review_state in ('draft', 'in_review', 'human_approved', 'rejected')
  ),
  author_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  reviewed_by_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  licence_ref text check (licence_ref is null or char_length(licence_ref) <= 200),
  rights_expire_on date,
  territories text[] not null default '{}',
  version integer not null default 1 check (version >= 1),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- The non-goal as a constraint: machine-written content cannot be
  -- published without a human approval on record.
  constraint knowledge_ai_needs_human_approval check (
    provenance not in ('ai_generated', 'ai_assisted')
    or published_at is null
    or review_state = 'human_approved'
  ),
  constraint knowledge_licensed_needs_licence check (
    provenance <> 'licensed_third_party' or licence_ref is not null
  ),
  constraint knowledge_reviewer_not_author check (
    reviewed_by_staff_id is null
    or author_staff_id is null
    or reviewed_by_staff_id <> author_staff_id
  )
);

create index if not exists knowledge_articles_published_idx
  on public.knowledge_articles (retailer_id, audience, published_at desc)
  where published_at is not null and deleted_at is null;

create table if not exists public.guided_tiers (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  tier_key text not null check (char_length(tier_key) between 2 and 64),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 200),
  included_package_keys text[] not null,
  price_minor_units integer not null check (price_minor_units >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guided_tier_key_unique unique (retailer_id, tier_key),
  constraint guided_tier_has_packages check (
    array_length(included_package_keys, 1) is not null
  )
);

create table if not exists public.consultancy_projects (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 300),
  state text not null default 'requested' check (
    state in ('requested', 'scoped', 'in_delivery', 'delivered', 'closed')
  ),
  -- A project closes only on the retailer's approval: consultancy whose
  -- output the client never signed off is consultancy nobody can evaluate.
  retailer_approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consultancy_close_needs_approval check (
    state <> 'closed' or retailer_approved_at is not null
  )
);

create table if not exists public.consultancy_deliverables (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  project_id uuid not null
    references public.consultancy_projects (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 300),
  -- Whether the retailer can actually see it. A deliverable only PAON can
  -- see is not a deliverable.
  retailer_visible boolean not null default true,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_roleplay_grades (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  staff_id uuid not null
    references public.retailer_staff_members (id) on delete cascade,
  lesson_key text not null check (char_length(lesson_key) between 2 and 120),
  -- [{ criterionKey, evidenceRef, observedBehaviour }]. Non-empty by
  -- CHECK: ungrounded feedback teaches nothing and cannot be disputed.
  evidence jsonb not null,
  graded_by_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint academy_grade_has_evidence check (
    jsonb_typeof(evidence) = 'array' and jsonb_array_length(evidence) > 0
  ),
  -- No aggregate score column, same reasoning as 11.2 and 11.3: an average
  -- per advisor is a performance ranking wearing a training costume.
  constraint academy_grade_self_grading check (
    graded_by_staff_id is null or graded_by_staff_id <> staff_id
  )
);

create table if not exists public.product_hypotheses (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 300),
  -- Which of demand / margin / supplier / quality has actual evidence.
  evidence_kinds text[] not null default '{}',
  state text not null default 'hypothesis' check (
    state in ('hypothesis', 'evidenced', 'rejected')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Deliberately no purchase_order_id, no committed_quantity and no
  -- supplier order column: the non-goal is "no speculative stock
  -- purchase", and the honest form of that is nowhere to record one.
  constraint product_hypothesis_evidenced_needs_all check (
    state <> 'evidenced'
    or (
      'demand' = any (evidence_kinds)
      and 'margin' = any (evidence_kinds)
      and 'supplier' = any (evidence_kinds)
      and 'quality' = any (evidence_kinds)
    )
  )
);

-- 16.3 pack registry. A pack declares overrides; it cannot declare an
-- entity that already exists in the core, which is what "no core fork"
-- means in practice.
create table if not exists public.vertical_packs (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  vertical_key text not null check (char_length(vertical_key) between 2 and 64),
  terminology jsonb not null default '{}'::jsonb,
  form_keys text[] not null default '{}',
  workflow_keys text[] not null default '{}',
  sensitive_field_keys text[] not null default '{}',
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vertical_pack_key_unique unique (retailer_id, vertical_key),
  constraint vertical_pack_terminology_object check (
    jsonb_typeof(terminology) = 'object'
  )
);

-- 16.4 store instrumentation.
create table if not exists public.store_zones (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  branch_id uuid references public.retailer_branches (id) on delete cascade,
  zone_key text not null check (char_length(zone_key) between 2 and 64),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 200),
  playbook jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_zone_key_unique unique (retailer_id, zone_key)
);

create table if not exists public.store_observations (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  zone_id uuid not null references public.store_zones (id) on delete cascade,
  adapter_kind text not null check (
    adapter_kind in (
      'anonymous_presence_count', 'zone_dwell_anonymous',
      'display_interaction', 'garment_tag_scan'
    )
  ),
  -- No staff_id column and no biometric template column, deliberately.
  -- See the header note; a test asserts both absences.
  observed_count integer check (observed_count is null or observed_count >= 0),
  dwell_seconds integer check (dwell_seconds is null or dwell_seconds >= 0),
  garment_ref text check (garment_ref is null or char_length(garment_ref) <= 200),
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists store_observations_zone_idx
  on public.store_observations (zone_id, observed_at desc);

create table if not exists public.store_sessions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  branch_id uuid references public.retailer_branches (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  advisor_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  customer_approved_look_ref text
    check (customer_approved_look_ref is null
           or char_length(customer_approved_look_ref) <= 200),
  device_failed boolean not null default false,
  manual_fallback_used boolean not null default false,
  outcome_note text check (
    outcome_note is null or char_length(btrim(outcome_note)) <= 2000
  ),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A session on paper is as valid as one on a mirror; what is not valid
  -- is a device failure with nothing recorded in its place.
  constraint store_session_fallback_recorded check (
    device_failed = false or manual_fallback_used = true or closed_at is null
  ),
  constraint store_session_outcome_needs_look check (
    closed_at is null or customer_approved_look_ref is not null
  )
);

create table if not exists public.store_comparison_records (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  session_id uuid not null references public.store_sessions (id) on delete cascade,
  construction_kind text not null check (
    construction_kind in ('half_canvas', 'full_canvas', 'handmade')
  ),
  customer_preferred boolean not null default false,
  -- The reason is the whole value: "chose full canvas" is a sale, "chose
  -- full canvas because the chest felt softer" is something the next
  -- advisor can use.
  noted_reason text check (
    noted_reason is null or char_length(btrim(noted_reason)) between 5 and 2000
  ),
  created_at timestamptz not null default now(),
  constraint store_comparison_preference_has_reason check (
    customer_preferred = false or noted_reason is not null
  )
);

-- 16.5 Moonstruck. Every table below hangs off the EXISTING
-- wedding_parties / wedding_party_members rows.
create table if not exists public.wedding_inspiration_items (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  wedding_party_id uuid not null
    references public.wedding_parties (id) on delete cascade,
  added_by_customer_id uuid references public.customers (id) on delete set null,
  image_ref text check (image_ref is null or char_length(image_ref) <= 2000),
  note text check (note is null or char_length(btrim(note)) <= 2000),
  -- Rights matter here too: a couple pinning a magazine photo is fine
  -- internally and is not licensed for publication.
  internal_only boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wedding_design_choices (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  wedding_party_id uuid not null
    references public.wedding_parties (id) on delete cascade,
  -- References the EXISTING member row; null means a party-wide choice.
  wedding_party_member_id uuid
    references public.wedding_party_members (id) on delete cascade,
  slot_key text not null check (char_length(slot_key) between 2 and 64),
  value_key text not null check (char_length(value_key) between 1 and 120),
  coordinated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A coordinated choice belongs to the party, not to one member.
  constraint wedding_coordinated_is_party_wide check (
    coordinated = false or wedding_party_member_id is null
  )
);

create table if not exists public.wedding_group_fittings (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  wedding_party_id uuid not null
    references public.wedding_parties (id) on delete cascade,
  scheduled_at timestamptz not null,
  capacity smallint not null check (capacity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wedding_guest_vouchers (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  wedding_party_id uuid not null
    references public.wedding_parties (id) on delete cascade,
  -- Deliberately NOT a customer_id. A wedding guest list is not a customer
  -- list: the couple shared those names to organise a wedding, not to
  -- populate a CRM.
  guest_label text not null check (char_length(btrim(guest_label)) between 1 and 200),
  value_minor_units integer not null check (value_minor_units > 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  funding_source text not null
    check (char_length(funding_source) between 2 and 64),
  expires_on date not null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wedding_aftercare_plans (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  wedding_party_id uuid not null
    references public.wedding_parties (id) on delete cascade,
  wedding_party_member_id uuid
    references public.wedding_party_members (id) on delete cascade,
  instruction text not null check (char_length(btrim(instruction)) between 5 and 2000),
  due_on date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array[
    'knowledge_articles', 'guided_tiers', 'consultancy_projects',
    'consultancy_deliverables', 'academy_roleplay_grades',
    'product_hypotheses', 'vertical_packs', 'store_zones',
    'store_observations', 'store_sessions', 'store_comparison_records',
    'wedding_inspiration_items', 'wedding_design_choices',
    'wedding_group_fittings', 'wedding_guest_vouchers',
    'wedding_aftercare_plans'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon', t);
    execute format(
      'grant select on table public.%I to authenticated, service_role', t
    );
    execute format(
      'create policy %I on public.%I for select to authenticated using ('
      || 'retailer_id = public.current_retailer_id() '
      || 'and public.current_retailer_role() is not null)',
      t || '_retailer_select', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ('
      || 'retailer_id = public.current_retailer_id() '
      || 'and public.current_retailer_role() in '
      || '(''owner'', ''manager'', ''admin'', ''sales_associate''))',
      t || '_staff_insert', t
    );
    execute format(
      'grant insert on table public.%I to authenticated, service_role', t
    );
  end loop;
end $$;

-- Observations and grades are append-only. An editable observation log is
-- not an observation log, and an editable grade is a grade the trainee
-- cannot rely on.
do $$
declare
  t text;
begin
  foreach t in array array[
    'knowledge_articles', 'guided_tiers', 'consultancy_projects',
    'consultancy_deliverables', 'product_hypotheses', 'vertical_packs',
    'store_zones', 'store_sessions', 'wedding_inspiration_items',
    'wedding_design_choices', 'wedding_group_fittings',
    'wedding_guest_vouchers', 'wedding_aftercare_plans'
  ] loop
    execute format(
      'grant update on table public.%I to authenticated, service_role', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ('
      || 'retailer_id = public.current_retailer_id() '
      || 'and public.current_retailer_role() in '
      || '(''owner'', ''manager'', ''admin'', ''sales_associate'')) '
      || 'with check (retailer_id = public.current_retailer_id())',
      t || '_staff_update', t
    );
  end loop;
end $$;

comment on table public.store_observations is
  'PHASE 16.4 / EXP-101. Deliberately has no staff_id and no biometric '
  'template column: a zone sensor that can report which advisor stood '
  'where becomes a productivity monitor the day someone asks it to.';
comment on table public.wedding_guest_vouchers is
  'PHASE 16.5 / WED-101. Holds a guest LABEL, never a customer_id: a '
  'wedding guest list is not a customer list.';
comment on table public.product_hypotheses is
  'PHASE 16.2. Has no purchase order, committed quantity or supplier '
  'order column - "no speculative stock purchase" means nowhere to '
  'record one.';
