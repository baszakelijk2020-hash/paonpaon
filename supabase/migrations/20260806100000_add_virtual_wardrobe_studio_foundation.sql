-- Virtual Wardrobe Studio — shared foundation (VWS-001..003 / PHASE 4.6 /
-- ADR-074). Generation attaches to the existing `outfits`/`wardrobe_roadmaps`
-- tables (PHASE 4.2); this migration adds only what has no existing PAON
-- equivalent: identity/reference photos (`style_portraits`), retailer
-- generation defaults (`retailer_visual_presets`), the generation
-- snapshot/queue/result (`wardrobe_visualization_jobs`), and feedback
-- (`wardrobe_visualization_feedback`). Fit preference is deliberately NOT a
-- new table here — see the four canonical `metadata_concepts` seeded below
-- and ADR-074 §3.2 for why (ADR-016/055 archived a customer-level
-- manufacturing fit profile; this is visualization-only and reuses the
-- existing StyleProfile evidence path instead of reviving it).
--
-- No UI ships in this slice. See docs/VIRTUAL_WARDROBE_STUDIO_BLUEPRINT.md
-- §5 for 4.7-4.10.

-- ---------------------------------------------------------------------------
-- outfits — extend for customer authorship (VWS-001). Advisors remain able
-- to author outfits (ROAD-002); customers composing their own try-on look
-- is the one real gap this closes, per ADR-074 point 3.
-- ---------------------------------------------------------------------------

alter table public.outfits
  alter column created_by_staff_id drop not null;

alter table public.outfits
  add column if not exists created_by_customer_id uuid
    references public.customers (id) on delete cascade;

alter table public.outfits
  drop constraint if exists outfits_author_chk;

alter table public.outfits
  add constraint outfits_author_chk check (
    (created_by_staff_id is not null) <> (created_by_customer_id is not null)
  );

create index if not exists outfits_created_by_customer_idx
  on public.outfits (created_by_customer_id)
  where created_by_customer_id is not null;

-- Re-derive the tenancy guard: a customer-authored outfit must have its
-- creator match the outfit's own customer_id and retailer relationship,
-- same shape as the staff-authored branch already enforced.
create or replace function public.enforce_outfit_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_staff_retailer_id uuid;
  v_customer_retailer_id uuid;
  v_roadmap_retailer_id uuid;
  v_roadmap_customer_id uuid;
begin
  if new.created_by_staff_id is not null then
    select staff.retailer_id into v_staff_retailer_id
    from public.retailer_staff_members as staff
    where staff.id = new.created_by_staff_id
      and staff.deleted_at is null;
    if v_staff_retailer_id is null
      or v_staff_retailer_id <> new.retailer_id then
      raise exception 'Outfit author does not belong to the retailer';
    end if;
  end if;

  if new.created_by_customer_id is not null then
    if new.created_by_customer_id <> new.customer_id then
      raise exception 'Customer-authored outfit must be authored by its own customer';
    end if;
    select c.retailer_id into v_customer_retailer_id
    from public.customers as c
    where c.id = new.created_by_customer_id
      and c.deleted_at is null;
    if v_customer_retailer_id is null
      or v_customer_retailer_id <> new.retailer_id then
      raise exception 'Outfit author does not belong to the retailer';
    end if;
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

-- Customers may insert their own outfits. Staff insert policy (existing)
-- is untouched.
create policy "customers insert own outfits"
  on public.outfits for insert to authenticated
  with check (
    created_by_staff_id is null
    and created_by_customer_id is not null
    and exists (
      select 1 from public.customers c
      where c.id = outfits.created_by_customer_id
        and c.id = outfits.customer_id
        and c.retailer_id = outfits.retailer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

-- ---------------------------------------------------------------------------
-- style_portraits + style_portrait_references
-- ---------------------------------------------------------------------------

create table if not exists public.style_portraits (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  version integer not null default 1 check (version >= 1),
  status text not null default 'draft' check (
    status in (
      'draft', 'preview_generated', 'approved', 'rejected', 'superseded'
    )
  ),
  fit_archetype_concept_id uuid references public.metadata_concepts (id) on delete set null,
  preview_image_url text check (
    preview_image_url is null or char_length(preview_image_url) <= 2000
  ),
  approved_at timestamptz,
  superseded_at timestamptz,
  rejected_reason text check (
    rejected_reason is null or char_length(btrim(rejected_reason)) <= 500
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint style_portraits_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate
);

create index if not exists style_portraits_customer_idx
  on public.style_portraits (customer_id, version desc);

-- At most one approved portrait active per customer at a time (a new
-- approval must supersede the previous one first).
create unique index if not exists style_portraits_customer_approved_uidx
  on public.style_portraits (customer_id)
  where status = 'approved';

comment on table public.style_portraits is
  'VWS-001: versioned, customer-approved visual reference set for wardrobe '
  'visualization. Distinct from silhouette_analysis_sessions (different '
  'purpose) and never conflated with it (ADR-074).';

create trigger set_style_portraits_updated_at
  before update on public.style_portraits
  for each row execute function public.set_updated_at();

create table if not exists public.style_portrait_references (
  id uuid primary key default gen_random_uuid(),
  style_portrait_id uuid not null references public.style_portraits (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  kind text not null check (
    kind in ('face', 'full_body', 'side', 'pose', 'outfit_reference')
  ),
  storage_bucket text not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index if not exists style_portrait_references_portrait_idx
  on public.style_portrait_references (style_portrait_id);

create or replace function public.enforce_style_portrait_reference_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_portrait_retailer_id uuid;
begin
  select p.retailer_id into v_portrait_retailer_id
  from public.style_portraits as p
  where p.id = new.style_portrait_id;
  if v_portrait_retailer_id is null
    or v_portrait_retailer_id <> new.retailer_id then
    raise exception 'Style portrait reference does not match portrait retailer';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_style_portrait_reference_tenancy() from public;

create trigger enforce_style_portrait_reference_tenancy_on_write
  before insert or update on public.style_portrait_references
  for each row execute function public.enforce_style_portrait_reference_tenancy();

alter table public.style_portraits enable row level security;
alter table public.style_portrait_references enable row level security;

revoke all on table public.style_portraits from anon;
revoke all on table public.style_portrait_references from anon;

create policy "customers read own style portraits"
  on public.style_portraits for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = style_portraits.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "customers write own style portraits"
  on public.style_portraits for insert to authenticated
  with check (
    exists (
      select 1 from public.customers c
      where c.id = style_portraits.customer_id
        and c.retailer_id = style_portraits.retailer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "customers update own style portraits"
  on public.style_portraits for update to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = style_portraits.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.customers c
      where c.id = style_portraits.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant style portraits"
  on public.style_portraits for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read style portraits"
  on public.style_portraits for select to authenticated
  using ((select public.is_platform_staff()));

create policy "customers read own style portrait references"
  on public.style_portrait_references for select to authenticated
  using (
    exists (
      select 1 from public.style_portraits p
      join public.customers c on c.id = p.customer_id
      where p.id = style_portrait_references.style_portrait_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "customers write own style portrait references"
  on public.style_portrait_references for insert to authenticated
  with check (
    exists (
      select 1 from public.style_portraits p
      join public.customers c on c.id = p.customer_id
      where p.id = style_portrait_references.style_portrait_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant style portrait references"
  on public.style_portrait_references for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

grant select, insert, update on table public.style_portraits
  to authenticated, service_role;
grant select, insert on table public.style_portrait_references
  to authenticated, service_role;
grant all on table public.style_portraits to service_role;
grant all on table public.style_portrait_references to service_role;

-- ---------------------------------------------------------------------------
-- retailer_visual_presets
-- ---------------------------------------------------------------------------

create table if not exists public.retailer_visual_presets (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  is_default boolean not null default false,
  background_type text not null check (
    background_type in ('studio_neutral', 'retailer_image', 'editorial_scene')
  ),
  background_image_url text check (
    background_image_url is null or char_length(background_image_url) <= 2000
  ),
  pose_family text not null check (length(btrim(pose_family)) between 1 and 120),
  camera_height text not null check (length(btrim(camera_height)) between 1 and 120),
  camera_distance text not null check (length(btrim(camera_distance)) between 1 and 120),
  crop text not null check (length(btrim(crop)) between 1 and 120),
  aspect_ratio text not null check (length(btrim(aspect_ratio)) between 1 and 20),
  lighting text not null check (length(btrim(lighting)) between 1 and 120),
  expression text not null check (length(btrim(expression)) between 1 and 120),
  visual_treatment text not null check (length(btrim(visual_treatment)) between 1 and 500),
  negative_constraints jsonb not null default '[]'::jsonb
    check (jsonb_typeof(negative_constraints) = 'array'),
  -- Not a configuration knob: always true, enforced in SQL, not left to
  -- prompt wording (founder brief's identity-preservation boundary).
  body_modification_prohibited boolean not null default true
    check (body_modification_prohibited = true),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists retailer_visual_presets_default_uidx
  on public.retailer_visual_presets (retailer_id)
  where is_default = true;

comment on table public.retailer_visual_presets is
  'VWS-001: retailer-configured generation defaults. Routine customer/advisor '
  'generation always uses the retailer default preset automatically.';

create trigger set_retailer_visual_presets_updated_at
  before update on public.retailer_visual_presets
  for each row execute function public.set_updated_at();

alter table public.retailer_visual_presets enable row level security;

revoke all on table public.retailer_visual_presets from anon;

create policy "authenticated read tenant visual presets"
  on public.retailer_visual_presets for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    or (select public.is_platform_staff())
  );

create policy "customers read their retailer's visual presets"
  on public.retailer_visual_presets for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.retailer_id = retailer_visual_presets.retailer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer managers write tenant visual presets"
  on public.retailer_visual_presets for insert to authenticated
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
  );

create policy "retailer managers update tenant visual presets"
  on public.retailer_visual_presets for update to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
  )
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
  );

grant select, insert, update on table public.retailer_visual_presets
  to authenticated, service_role;
grant all on table public.retailer_visual_presets to service_role;

-- ---------------------------------------------------------------------------
-- wardrobe_visualization_jobs — generation snapshot/queue/result
-- ---------------------------------------------------------------------------

create table if not exists public.wardrobe_visualization_jobs (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  outfit_id uuid not null references public.outfits (id) on delete cascade,
  style_portrait_id uuid not null references public.style_portraits (id) on delete restrict,
  retailer_visual_preset_id uuid not null references public.retailer_visual_presets (id) on delete restrict,
  provider text not null default 'openai',
  model text not null,
  input_snapshot jsonb not null,
  input_hash text not null check (char_length(input_hash) between 1 and 128),
  status text not null default 'queued' check (
    status in ('queued', 'generating', 'ready', 'failed', 'cancelled')
  ),
  attempt integer not null default 0 check (attempt >= 0),
  output_image_url text check (
    output_image_url is null or char_length(output_image_url) <= 2000
  ),
  error_message text check (
    error_message is null or char_length(error_message) <= 2000
  ),
  estimated_cost_cents integer check (estimated_cost_cents is null or estimated_cost_cents >= 0),
  actual_cost_cents integer check (actual_cost_cents is null or actual_cost_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wardrobe_visualization_jobs_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint wardrobe_visualization_jobs_ready_output_chk check (
    status <> 'ready' or output_image_url is not null
  ),
  constraint wardrobe_visualization_jobs_failed_error_chk check (
    status <> 'failed' or error_message is not null
  )
);

create index if not exists wardrobe_visualization_jobs_customer_idx
  on public.wardrobe_visualization_jobs (customer_id, created_at desc);
create index if not exists wardrobe_visualization_jobs_outfit_idx
  on public.wardrobe_visualization_jobs (outfit_id, created_at desc);
create index if not exists wardrobe_visualization_jobs_status_idx
  on public.wardrobe_visualization_jobs (status, created_at);

-- Idempotency: no duplicate active job for the same outfit + exact input.
create unique index if not exists wardrobe_visualization_jobs_active_input_uidx
  on public.wardrobe_visualization_jobs (outfit_id, input_hash)
  where status in ('queued', 'generating');

comment on table public.wardrobe_visualization_jobs is
  'VWS-001: immutable generation snapshot + queue + result. Writes only '
  'through the RPCs below; an image is never user-visible until status is '
  'ready and it has been copied into PAON-controlled storage.';

create trigger set_wardrobe_visualization_jobs_updated_at
  before update on public.wardrobe_visualization_jobs
  for each row execute function public.set_updated_at();

create or replace function public.enforce_wardrobe_visualization_job_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_outfit_retailer_id uuid;
  v_outfit_customer_id uuid;
  v_portrait_retailer_id uuid;
  v_portrait_customer_id uuid;
  v_preset_retailer_id uuid;
begin
  select o.retailer_id, o.customer_id into v_outfit_retailer_id, v_outfit_customer_id
  from public.outfits as o
  where o.id = new.outfit_id and o.deleted_at is null;
  if v_outfit_retailer_id is null
    or v_outfit_retailer_id <> new.retailer_id
    or v_outfit_customer_id <> new.customer_id then
    raise exception 'Visualization job outfit does not match the relationship';
  end if;

  select p.retailer_id, p.customer_id into v_portrait_retailer_id, v_portrait_customer_id
  from public.style_portraits as p
  where p.id = new.style_portrait_id;
  if v_portrait_retailer_id is null
    or v_portrait_retailer_id <> new.retailer_id
    or v_portrait_customer_id <> new.customer_id then
    raise exception 'Visualization job style portrait does not match the relationship';
  end if;

  select v.retailer_id into v_preset_retailer_id
  from public.retailer_visual_presets as v
  where v.id = new.retailer_visual_preset_id;
  if v_preset_retailer_id is null or v_preset_retailer_id <> new.retailer_id then
    raise exception 'Visualization job preset does not belong to the retailer';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_wardrobe_visualization_job_tenancy() from public;

create trigger enforce_wardrobe_visualization_job_tenancy_on_write
  before insert on public.wardrobe_visualization_jobs
  for each row execute function public.enforce_wardrobe_visualization_job_tenancy();

alter table public.wardrobe_visualization_jobs enable row level security;

revoke all on table public.wardrobe_visualization_jobs from anon;

create policy "customers read own visualization jobs"
  on public.wardrobe_visualization_jobs for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = wardrobe_visualization_jobs.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant visualization jobs"
  on public.wardrobe_visualization_jobs for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read visualization jobs"
  on public.wardrobe_visualization_jobs for select to authenticated
  using ((select public.is_platform_staff()));

-- Writes only through the RPCs below (queue claim/complete needs
-- security-definer transition control, same shape as email_outbox).
grant select on table public.wardrobe_visualization_jobs
  to authenticated, service_role;
grant all on table public.wardrobe_visualization_jobs to service_role;

-- Enqueue: caller must be the owning customer or an authorized advisor
-- for the same relationship. Re-derives identity server-side.
create or replace function public.enqueue_wardrobe_visualization_job(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_outfit_id uuid,
  p_style_portrait_id uuid,
  p_retailer_visual_preset_id uuid,
  p_provider text,
  p_model text,
  p_input_snapshot jsonb,
  p_input_hash text
)
returns public.wardrobe_visualization_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.wardrobe_visualization_jobs%rowtype;
  v_is_owning_customer boolean;
  v_is_authorized_advisor boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select exists (
    select 1 from public.customers c
    where c.id = p_customer_id
      and c.retailer_id = p_retailer_id
      and c.user_id = auth.uid()
      and c.deleted_at is null
  ) into v_is_owning_customer;

  select exists (
    select 1 from public.customers c
    where c.id = p_customer_id
      and c.retailer_id = p_retailer_id
      and c.deleted_at is null
  ) and public.current_retailer_id() = p_retailer_id
    and public.current_retailer_role() in (
      'sales_associate', 'manager', 'admin', 'owner'
    ) into v_is_authorized_advisor;

  if not v_is_owning_customer and not v_is_authorized_advisor then
    raise exception 'Not authorized to enqueue this visualization job';
  end if;

  insert into public.wardrobe_visualization_jobs (
    retailer_id, customer_id, outfit_id, style_portrait_id,
    retailer_visual_preset_id, provider, model, input_snapshot, input_hash
  ) values (
    p_retailer_id, p_customer_id, p_outfit_id, p_style_portrait_id,
    p_retailer_visual_preset_id, p_provider, p_model, p_input_snapshot, p_input_hash
  )
  on conflict (outfit_id, input_hash) where status in ('queued', 'generating')
  do nothing
  returning * into v_job;

  if v_job.id is null then
    select * into v_job
    from public.wardrobe_visualization_jobs
    where outfit_id = p_outfit_id
      and input_hash = p_input_hash
      and status in ('queued', 'generating')
    order by created_at desc
    limit 1;
  end if;

  return v_job;
end;
$$;

-- Cancellation: only while still queued (VWS queue requirement — cancel
-- before processing).
create or replace function public.cancel_wardrobe_visualization_job(
  p_job_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.wardrobe_visualization_jobs%rowtype;
  v_is_owning_customer boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_job from public.wardrobe_visualization_jobs where id = p_job_id;
  if not found then raise exception 'Job not found'; end if;

  select exists (
    select 1 from public.customers c
    where c.id = v_job.customer_id
      and c.user_id = auth.uid()
      and c.deleted_at is null
  ) into v_is_owning_customer;

  if not v_is_owning_customer then
    raise exception 'Not authorized to cancel this job';
  end if;
  if v_job.status <> 'queued' then
    raise exception 'Only a queued job can be cancelled';
  end if;

  update public.wardrobe_visualization_jobs
    set status = 'cancelled'
    where id = p_job_id;
end;
$$;

-- Queue claim: sequential processing, safe concurrent workers, `for update
-- skip locked` exactly like claim_pending_emails.
create or replace function public.claim_pending_wardrobe_visualization_jobs(
  p_limit integer default 5
)
returns setof public.wardrobe_visualization_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update public.wardrobe_visualization_jobs
    set status = 'generating', attempt = attempt + 1
    where id in (
      select id from public.wardrobe_visualization_jobs
      where status = 'queued'
      order by created_at
      limit p_limit
      for update skip locked
    )
    returning *;
end;
$$;

-- Completion: the runner (service_role, no auth.uid()) reports the result.
create or replace function public.complete_wardrobe_visualization_job(
  p_job_id uuid,
  p_status text,
  p_output_image_url text default null,
  p_error_message text default null,
  p_actual_cost_cents integer default null
)
returns public.wardrobe_visualization_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.wardrobe_visualization_jobs%rowtype;
begin
  if p_status not in ('ready', 'failed') then
    raise exception 'Invalid completion status';
  end if;

  update public.wardrobe_visualization_jobs
    set status = p_status,
        output_image_url = p_output_image_url,
        error_message = p_error_message,
        actual_cost_cents = coalesce(p_actual_cost_cents, actual_cost_cents)
    where id = p_job_id and status = 'generating'
    returning * into v_job;

  if v_job.id is null then
    raise exception 'Job not found or not in progress';
  end if;

  return v_job;
end;
$$;

revoke all on function public.enqueue_wardrobe_visualization_job(
  uuid, uuid, uuid, uuid, uuid, text, text, jsonb, text
) from public;
revoke all on function public.cancel_wardrobe_visualization_job(uuid) from public;
revoke all on function public.claim_pending_wardrobe_visualization_jobs(integer) from public;
revoke all on function public.complete_wardrobe_visualization_job(
  uuid, text, text, text, integer
) from public;

grant execute on function public.enqueue_wardrobe_visualization_job(
  uuid, uuid, uuid, uuid, uuid, text, text, jsonb, text
) to authenticated, service_role;
grant execute on function public.cancel_wardrobe_visualization_job(uuid)
  to authenticated, service_role;
grant execute on function public.claim_pending_wardrobe_visualization_jobs(integer)
  to service_role;
grant execute on function public.complete_wardrobe_visualization_job(
  uuid, text, text, text, integer
) to service_role;

-- ---------------------------------------------------------------------------
-- wardrobe_visualization_feedback
-- ---------------------------------------------------------------------------

create table if not exists public.wardrobe_visualization_feedback (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  job_id uuid not null references public.wardrobe_visualization_jobs (id) on delete cascade,
  signal text not null check (
    signal in (
      'love_it', 'save', 'not_for_me', 'regenerate',
      'looks_like_me_no', 'fit_correction', 'colour_correction'
    )
  ),
  note text check (note is null or char_length(btrim(note)) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists wardrobe_visualization_feedback_job_idx
  on public.wardrobe_visualization_feedback (job_id, created_at desc);
create index if not exists wardrobe_visualization_feedback_customer_idx
  on public.wardrobe_visualization_feedback (customer_id, created_at desc);

create or replace function public.enforce_wardrobe_visualization_feedback_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_job_retailer_id uuid;
  v_job_customer_id uuid;
begin
  select j.retailer_id, j.customer_id into v_job_retailer_id, v_job_customer_id
  from public.wardrobe_visualization_jobs as j
  where j.id = new.job_id;
  if v_job_retailer_id is null
    or v_job_retailer_id <> new.retailer_id
    or v_job_customer_id <> new.customer_id then
    raise exception 'Feedback job does not match the relationship';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_wardrobe_visualization_feedback_tenancy() from public;

create trigger enforce_wardrobe_visualization_feedback_tenancy_on_write
  before insert on public.wardrobe_visualization_feedback
  for each row execute function public.enforce_wardrobe_visualization_feedback_tenancy();

alter table public.wardrobe_visualization_feedback enable row level security;

revoke all on table public.wardrobe_visualization_feedback from anon;

create policy "customers read own visualization feedback"
  on public.wardrobe_visualization_feedback for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = wardrobe_visualization_feedback.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "customers write own visualization feedback"
  on public.wardrobe_visualization_feedback for insert to authenticated
  with check (
    exists (
      select 1 from public.customers c
      where c.id = wardrobe_visualization_feedback.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant visualization feedback"
  on public.wardrobe_visualization_feedback for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

grant select, insert on table public.wardrobe_visualization_feedback
  to authenticated, service_role;
grant all on table public.wardrobe_visualization_feedback to service_role;

-- ---------------------------------------------------------------------------
-- Seed: four canonical fit-archetype MetadataConcepts (ADR-074 §3.2). No new
-- table — reachable through the existing upsert_declared_style_preference
-- RPC exactly like a style-quiz archetype. Idempotent, stable UUIDs.
-- ---------------------------------------------------------------------------

insert into public.metadata_concepts (
  id, retailer_id, kind, slug, canonical_name, attributes, active
)
values
  (
    'c3000000-0000-4000-8000-300000000001', null, 'fit',
    'fit-archetype-slim', 'Slim',
    '{"isFitArchetype": true, "order": 1, "description": "Close through the body, narrow lapel and leg.", "tailoring": {"lapelWidth": "narrow", "waistSuppression": "high", "jacketLength": "short", "shoulderExpression": "natural", "sleeveWidth": "narrow", "trouserRise": "mid", "thighEase": "close", "legWidth": "narrow", "trouserBreak": "no_break"}}'::jsonb,
    true
  ),
  (
    'c3000000-0000-4000-8000-300000000002', null, 'fit',
    'fit-archetype-classic', 'Classic',
    '{"isFitArchetype": true, "order": 2, "description": "Balanced, structured shoulder, moderate throughout.", "tailoring": {"lapelWidth": "moderate", "waistSuppression": "moderate", "jacketLength": "regular", "shoulderExpression": "structured", "sleeveWidth": "moderate", "trouserRise": "high", "thighEase": "moderate", "legWidth": "moderate", "trouserBreak": "slight_break"}}'::jsonb,
    true
  ),
  (
    'c3000000-0000-4000-8000-300000000003', null, 'fit',
    'fit-archetype-contemporary', 'Contemporary',
    '{"isFitArchetype": true, "order": 3, "description": "Natural shoulder, updated proportions, easy to wear.", "tailoring": {"lapelWidth": "moderate", "waistSuppression": "moderate", "jacketLength": "regular", "shoulderExpression": "natural", "sleeveWidth": "moderate", "trouserRise": "mid", "thighEase": "moderate", "legWidth": "moderate", "trouserBreak": "slight_break"}}'::jsonb,
    true
  ),
  (
    'c3000000-0000-4000-8000-300000000004', null, 'fit',
    'fit-archetype-fashion-wide', 'Fashion Wide',
    '{"isFitArchetype": true, "order": 4, "description": "Roped shoulder, full leg, deliberately expressive.", "tailoring": {"lapelWidth": "wide", "waistSuppression": "low", "jacketLength": "long", "shoulderExpression": "roped", "sleeveWidth": "wide", "trouserRise": "high", "thighEase": "full", "legWidth": "wide", "trouserBreak": "full_break"}}'::jsonb,
    true
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Private storage — one bucket, two path prefixes (references/ and
-- generations/), mirroring silhouette-evidence's exact bucket/RLS shape.
-- Generation outputs are written by the queue runner via the service-role
-- client, which bypasses Storage RLS entirely, so no authenticated insert
-- policy is needed for the generations/ prefix.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wardrobe-studio',
  'wardrobe-studio',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create or replace function public.can_access_wardrobe_studio_object(p_name text)
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

  return
    public.current_retailer_id() = v_retailer_id
    and public.current_retailer_role() in (
      'sales_associate', 'manager', 'admin', 'owner'
    );
end;
$$;

revoke all on function public.can_access_wardrobe_studio_object(text) from public;
grant execute on function public.can_access_wardrobe_studio_object(text)
  to authenticated, service_role;

create policy "authorized wardrobe studio actors can read objects"
  on storage.objects for select
  using (
    bucket_id = 'wardrobe-studio'
    and public.can_access_wardrobe_studio_object(name)
  );
create policy "authorized wardrobe studio actors can upload reference objects"
  on storage.objects for insert
  with check (
    bucket_id = 'wardrobe-studio'
    and name like '%/references/%'
    and public.can_access_wardrobe_studio_object(name)
  );
create policy "authorized wardrobe studio actors can delete reference objects"
  on storage.objects for delete
  using (
    bucket_id = 'wardrobe-studio'
    and name like '%/references/%'
    and public.can_access_wardrobe_studio_object(name)
  );
