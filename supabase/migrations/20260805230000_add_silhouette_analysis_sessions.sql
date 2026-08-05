-- FT-02 Silhouette analysis — consent/capture session state machine
-- (docs/FOUNDER_TOOL_BLUEPRINTS.md). The existing Level-1 carousel
-- (`silhouette-widget.tsx`, `recordFitToolObservation`/
-- `fitting_observations`) is a staff-facing reference-video
-- classification tool and is untouched by this migration — this adds
-- the separate, previously entirely-missing capability the blueprint's
-- own Current line named as outstanding: "no consent/capture/session
-- state machine exists yet ... this tool has no camera capture at all."
--
-- Exact session states from the blueprint's own State-and-wiring
-- section: consented, capturing, candidate, advisor_reviewed,
-- customer_confirmed, rejected, expired. `capturing` is reachable
-- (customer has opened capture but not yet uploaded) without any
-- capture row existing yet, so abandoning at that point already
-- satisfies "no orphaned media" trivially — no separate cleanup path
-- is needed for it.
--
-- Deliberately NOT built in this slice, named honestly rather than
-- invented:
-- - Automatic time-based expiry (the `expired` status is a real,
--   reachable, supported state — a session CAN be marked expired and
--   behaves correctly once it is — but no specific TTL duration is
--   specified anywhere in the founder brief or blueprint, so none is
--   invented here. Same discipline as PHASE.md 18.3's "no TTL policy
--   was ever specified, so none was invented."
-- - The customer_style_profiles connection the blueprint's
--   State-and-wiring section describes ("connect confirmed evidence to
--   customer_style_profiles"): doing this meaningfully requires a
--   concept taxonomy mapping each silhouette panel (S1-S5) to a real
--   `metadata_concepts` row, which does not exist anywhere in this
--   codebase today and is a taxonomy decision, not an engineering one.
--   Left for a follow-on slice once that taxonomy exists.
-- - Any actual image analysis/processing (Level 2/3) — explicitly out
--   of scope per the blueprint itself ("PAON must label the first two
--   latter steps as unavailable until validated").

create table public.silhouette_analysis_sessions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  status text not null default 'consented' check (
    status in (
      'consented', 'capturing', 'candidate', 'advisor_reviewed',
      'customer_confirmed', 'rejected', 'expired'
    )
  ),
  consented_at timestamptz not null default now(),
  advisor_reviewed_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  advisor_reviewed_at timestamptz,
  advisor_decision text check (advisor_decision in ('approved', 'rejected')),
  advisor_note text check (advisor_note is null or char_length(btrim(advisor_note)) <= 1000),
  customer_confirmed_at timestamptz,
  rejected_reason text check (
    rejected_reason is null
    or rejected_reason in ('advisor_rejected', 'customer_withdrew', 'expired_untouched')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index silhouette_analysis_sessions_customer_idx
  on public.silhouette_analysis_sessions (customer_id, created_at desc);
create index silhouette_analysis_sessions_retailer_status_idx
  on public.silhouette_analysis_sessions (retailer_id, status);
create trigger set_silhouette_analysis_sessions_updated_at
  before update on public.silhouette_analysis_sessions
  for each row execute function public.set_updated_at();

-- The private capture media, isolated from the structured session row
-- per the blueprint ("store the private media asset separately from
-- the structured candidate"). One row per uploaded photo; a session
-- normally has exactly one but the shape allows more without a schema
-- change (e.g. front/side angles) without claiming that UI exists yet.
create table public.silhouette_analysis_captures (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  session_id uuid not null references public.silhouette_analysis_sessions (id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null check (char_length(btrim(file_name)) between 1 and 255),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);
create index silhouette_analysis_captures_session_idx
  on public.silhouette_analysis_captures (session_id);

alter table public.silhouette_analysis_sessions enable row level security;
alter table public.silhouette_analysis_captures enable row level security;

create policy "platform reads all silhouette analysis sessions"
  on public.silhouette_analysis_sessions for select
  using (public.is_platform_staff());
create policy "a customer reads their own silhouette analysis sessions"
  on public.silhouette_analysis_sessions for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = silhouette_analysis_sessions.customer_id
        and c.user_id = auth.uid()
    )
  );
create policy "retailer staff read their retailer's silhouette analysis sessions"
  on public.silhouette_analysis_sessions for select
  using (retailer_id = public.current_retailer_id());

create policy "platform reads all silhouette analysis captures"
  on public.silhouette_analysis_captures for select
  using (public.is_platform_staff());
create policy "a customer reads their own silhouette analysis captures"
  on public.silhouette_analysis_captures for select
  using (
    exists (
      select 1 from public.silhouette_analysis_sessions s
      join public.customers c on c.id = s.customer_id
      where s.id = silhouette_analysis_captures.session_id
        and c.user_id = auth.uid()
    )
  );
create policy "retailer staff read their retailer's silhouette analysis captures"
  on public.silhouette_analysis_captures for select
  using (
    exists (
      select 1 from public.silhouette_analysis_sessions s
      where s.id = silhouette_analysis_captures.session_id
        and s.retailer_id = public.current_retailer_id()
    )
  );

-- Writes only through the RPCs below (same narrow-RPC, self-deriving
-- caller identity shape used throughout this codebase). service_role
-- grant is what lets admin-client fixture seeding/cleanup in tests
-- work at all; RLS is the real boundary for `authenticated`.
grant select, insert, update, delete on public.silhouette_analysis_sessions
  to authenticated, service_role;
grant select, insert, delete on public.silhouette_analysis_captures
  to authenticated, service_role;

-- Private storage bucket for capture media, mirroring
-- wardrobe-evidence's exact bucket/RLS shape (20260730180000).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'silhouette-evidence',
  'silhouette-evidence',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create or replace function public.can_access_silhouette_storage_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  v_folders text[] := storage.foldername(p_name);
  v_retailer_id uuid;
  v_session_id uuid;
  v_session public.silhouette_analysis_sessions%rowtype;
begin
  if public.is_platform_staff() then return true; end if;
  if array_length(v_folders, 1) < 2 then return false; end if;

  begin
    v_retailer_id := v_folders[1]::uuid;
    v_session_id := v_folders[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  select * into v_session from public.silhouette_analysis_sessions
    where id = v_session_id;
  if not found or v_session.retailer_id <> v_retailer_id then
    return false;
  end if;

  if exists (
    select 1 from public.customers c
    where c.id = v_session.customer_id
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

create policy "authorized silhouette actors can read capture objects"
  on storage.objects for select
  using (
    bucket_id = 'silhouette-evidence'
    and public.can_access_silhouette_storage_object(name)
  );
create policy "authorized silhouette actors can upload capture objects"
  on storage.objects for insert
  with check (
    bucket_id = 'silhouette-evidence'
    and public.can_access_silhouette_storage_object(name)
  );
create policy "authorized silhouette actors can delete capture objects"
  on storage.objects for delete
  using (
    bucket_id = 'silhouette-evidence'
    and public.can_access_silhouette_storage_object(name)
  );

-- Customer starts a session with an explicit action — the act of
-- starting IS the consent, matching this codebase's repeated "explicit
-- action, not implicit side effect" precedent (swipe deck saves, suit
-- configurator saves, gift dispatch). No covert camera start: nothing
-- before this call can access the camera or storage bucket at all.
-- Self-creates the caller's Customer row on a first interaction, same
-- shape as add_concept_scan_selection/save_suit_configuration_intent —
-- a first-time visitor must be able to start this without an existing
-- relationship already on file.
create or replace function public.start_silhouette_analysis_session(
  p_retailer_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid;
  v_session_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select id into v_customer_id from public.customers
    where retailer_id = p_retailer_id and user_id = auth.uid() and deleted_at is null
    limit 1;
  if v_customer_id is null then
    insert into public.customers (retailer_id, user_id, full_name, email, lifecycle_stage)
    values (p_retailer_id, auth.uid(), coalesce(auth.jwt() ->> 'email', 'Customer'), auth.jwt() ->> 'email', 'prospect')
    returning id into v_customer_id;
    insert into public.customer_account_links (user_id, customer_id, retailer_id)
    values (auth.uid(), v_customer_id, p_retailer_id)
    on conflict (user_id, customer_id) do nothing;
  end if;

  insert into public.silhouette_analysis_sessions (retailer_id, customer_id, status)
    values (p_retailer_id, v_customer_id, 'consented')
    returning id into v_session_id;

  return v_session_id;
end;
$$;

-- Marks intent to open the camera/file picker. No media exists yet;
-- abandoning here leaves zero capture rows.
create or replace function public.begin_silhouette_capture(
  p_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.silhouette_analysis_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select s.* into v_session
    from public.silhouette_analysis_sessions s
    join public.customers c on c.id = s.customer_id
    where s.id = p_session_id and c.user_id = auth.uid();
  if not found then raise exception 'Session not found'; end if;
  if v_session.status <> 'consented' then
    raise exception 'Session is not awaiting capture';
  end if;

  update public.silhouette_analysis_sessions
    set status = 'capturing'
    where id = p_session_id;
end;
$$;

-- Records the uploaded capture and advances the session to 'candidate'.
-- Re-derives ownership server-side rather than trusting the caller.
create or replace function public.record_silhouette_capture(
  p_session_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.silhouette_analysis_sessions%rowtype;
  v_capture_id uuid;
  v_expected_prefix text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select s.* into v_session
    from public.silhouette_analysis_sessions s
    join public.customers c on c.id = s.customer_id
    where s.id = p_session_id and c.user_id = auth.uid();
  if not found then raise exception 'Session not found'; end if;
  if v_session.status not in ('consented', 'capturing') then
    raise exception 'Session is not awaiting capture';
  end if;

  v_expected_prefix := v_session.retailer_id::text || '/' || v_session.id::text || '/';
  if left(p_storage_path, length(v_expected_prefix)) <> v_expected_prefix then
    raise exception 'Storage path does not match this session';
  end if;
  if position('..' in p_storage_path) > 0 then
    raise exception 'Invalid storage path';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'silhouette-evidence' and name = p_storage_path
  ) then
    raise exception 'Uploaded object not found';
  end if;

  insert into public.silhouette_analysis_captures (
    retailer_id, session_id, storage_bucket, storage_path,
    file_name, mime_type, size_bytes
  ) values (
    v_session.retailer_id, p_session_id, 'silhouette-evidence', p_storage_path,
    p_file_name, p_mime_type, p_size_bytes
  ) returning id into v_capture_id;

  update public.silhouette_analysis_sessions
    set status = 'candidate'
    where id = p_session_id;

  return v_capture_id;
end;
$$;

-- Explicit withdrawal, at any point before a terminal state — deletes
-- the capture rows (their storage objects are removed by the caller
-- via the standard storage API, same as every other attachment-owning
-- flow in this codebase; Postgres row deletion and Storage object
-- deletion are not one transaction anywhere in this schema).
create or replace function public.withdraw_silhouette_analysis_consent(
  p_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.silhouette_analysis_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select s.* into v_session
    from public.silhouette_analysis_sessions s
    join public.customers c on c.id = s.customer_id
    where s.id = p_session_id and c.user_id = auth.uid();
  if not found then raise exception 'Session not found'; end if;
  if v_session.status in ('customer_confirmed', 'rejected', 'expired') then
    raise exception 'Session has already reached a final state';
  end if;

  delete from public.silhouette_analysis_captures where session_id = p_session_id;

  update public.silhouette_analysis_sessions
    set status = 'rejected', rejected_reason = 'customer_withdrew'
    where id = p_session_id;
end;
$$;

-- Advisor decision — the human review step. Never mutates any
-- approved-fit/measurement record; this is the blueprint's own stated
-- boundary ("connect ... never directly to approved measurements").
create or replace function public.decide_silhouette_analysis_candidate(
  p_session_id uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.silhouette_analysis_sessions%rowtype;
  v_staff_id uuid;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid decision';
  end if;
  if not public.is_alterations_advisor() then
    raise exception 'Not authorized to review silhouette analysis candidates';
  end if;

  select * into v_session from public.silhouette_analysis_sessions
    where id = p_session_id and retailer_id = public.current_retailer_id();
  if not found then raise exception 'Session not found'; end if;
  if v_session.status <> 'candidate' then
    raise exception 'Session is not awaiting review';
  end if;

  v_staff_id := public.current_staff_id();

  update public.silhouette_analysis_sessions
    set
      status = case when p_decision = 'approved' then 'advisor_reviewed' else 'rejected' end,
      advisor_reviewed_by_staff_id = v_staff_id,
      advisor_reviewed_at = now(),
      advisor_decision = p_decision,
      advisor_note = p_note,
      rejected_reason = case when p_decision = 'rejected' then 'advisor_rejected' else null end
    where id = p_session_id;
end;
$$;

-- Customer's own final confirmation, only once the advisor has
-- approved — the blueprint's own terminal "customer_confirmed" state.
create or replace function public.confirm_silhouette_analysis_candidate(
  p_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.silhouette_analysis_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select s.* into v_session
    from public.silhouette_analysis_sessions s
    join public.customers c on c.id = s.customer_id
    where s.id = p_session_id and c.user_id = auth.uid();
  if not found then raise exception 'Session not found'; end if;
  if v_session.status <> 'advisor_reviewed' or v_session.advisor_decision <> 'approved' then
    raise exception 'Session is not awaiting customer confirmation';
  end if;

  update public.silhouette_analysis_sessions
    set status = 'customer_confirmed', customer_confirmed_at = now()
    where id = p_session_id;
end;
$$;

revoke all on function public.start_silhouette_analysis_session(uuid) from public;
revoke all on function public.begin_silhouette_capture(uuid) from public;
revoke all on function public.record_silhouette_capture(uuid, text, text, text, bigint) from public;
revoke all on function public.withdraw_silhouette_analysis_consent(uuid) from public;
revoke all on function public.decide_silhouette_analysis_candidate(uuid, text, text) from public;
revoke all on function public.confirm_silhouette_analysis_candidate(uuid) from public;
revoke all on function public.can_access_silhouette_storage_object(text) from public;

grant execute on function public.start_silhouette_analysis_session(uuid)
  to authenticated, service_role;
grant execute on function public.begin_silhouette_capture(uuid)
  to authenticated, service_role;
grant execute on function public.record_silhouette_capture(uuid, text, text, text, bigint)
  to authenticated, service_role;
grant execute on function public.withdraw_silhouette_analysis_consent(uuid)
  to authenticated, service_role;
grant execute on function public.decide_silhouette_analysis_candidate(uuid, text, text)
  to authenticated, service_role;
grant execute on function public.confirm_silhouette_analysis_candidate(uuid)
  to authenticated, service_role;
grant execute on function public.can_access_silhouette_storage_object(text)
  to authenticated, service_role;

comment on table public.silhouette_analysis_sessions is
  'FT-02 consent/capture session state machine. States: consented, '
  'capturing, candidate, advisor_reviewed, customer_confirmed, '
  'rejected, expired. Writes only through the RPCs in this migration.';
