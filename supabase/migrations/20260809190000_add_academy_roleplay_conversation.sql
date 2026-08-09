-- Sales academy AI roleplay conversation (PHASE 17.8 / ADV-108).
--
-- 17.8's persona catalog and grading loop already exist
-- (20260805160000_add_academy_roleplay_personas.sql): a manager tags a
-- practiced persona on an `academy_roleplay_grades` row after the fact.
-- What is genuinely missing is the AI conversation partner itself — an
-- advisor practicing against a real persona reply, not just a label a
-- human applies afterward. This migration adds that layer on top of the
-- existing grading loop rather than a second one:
--
--   academy_roleplay_sessions   — one practice session, one persona
--   academy_roleplay_messages   — the real transcript (append-only)
--   academy_roleplay_grades.roleplay_session_id — links a grade to the
--     real transcript it was graded from, when the grade came from a
--     recorded session rather than in-person observation
--
-- Same "reserve on authorize, real RPC re-derives identity server-side"
-- posture already established by reserve_virtual_try_on_generation and
-- enqueue_wardrobe_visualization_job — a client cannot write an arbitrary
-- transcript by calling the tables directly, only through the RPCs below.

create table public.academy_roleplay_sessions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  staff_id uuid not null
    references public.retailer_staff_members (id) on delete cascade,
  persona_key text not null check (
    persona_key in (
      'first_time_buyer', 'browser', 'know_it_all', 'couple',
      'complaint_handling', 'white_glove'
    )
  ),
  status text not null default 'active' check (
    status in ('active', 'completed', 'abandoned')
  ),
  turn_count integer not null default 0 check (turn_count >= 0),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint academy_roleplay_sessions_ended_chk check (
    (status = 'active') = (ended_at is null)
  )
);

create index academy_roleplay_sessions_staff_idx
  on public.academy_roleplay_sessions (staff_id, created_at desc);
create index academy_roleplay_sessions_retailer_idx
  on public.academy_roleplay_sessions (retailer_id, created_at desc);
-- At most one active session per advisor — a second "Start practice" tap
-- resumes the existing session instead of forking the transcript.
create unique index academy_roleplay_sessions_one_active_per_staff
  on public.academy_roleplay_sessions (staff_id)
  where status = 'active';

comment on table public.academy_roleplay_sessions is
  'PHASE 17.8 / ADV-108: one AI sales-roleplay practice session against a '
  'published persona. Written only through start_academy_roleplay_session '
  'and end_academy_roleplay_session below.';

alter table public.academy_roleplay_sessions enable row level security;
revoke all on table public.academy_roleplay_sessions from anon;

create policy "advisors read own roleplay sessions"
  on public.academy_roleplay_sessions for select to authenticated
  using (
    exists (
      select 1 from public.retailer_staff_members s
      where s.id = academy_roleplay_sessions.staff_id
        and s.user_id = (select auth.uid())
        and s.deleted_at is null
    )
  );

create policy "managers read tenant roleplay sessions"
  on public.academy_roleplay_sessions for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
  );

create policy "platform staff read roleplay sessions"
  on public.academy_roleplay_sessions for select to authenticated
  using ((select public.is_platform_staff()));

-- Writes only through the RPCs below (identity/persona/one-active-session
-- re-derivation needs security-definer transition control).
grant select on table public.academy_roleplay_sessions
  to authenticated, service_role;
grant all on table public.academy_roleplay_sessions to service_role;

create table public.academy_roleplay_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.academy_roleplay_sessions (id) on delete cascade,
  turn_index integer not null check (turn_index >= 0),
  speaker text not null check (speaker in ('advisor', 'persona')),
  content text not null check (char_length(btrim(content)) between 1 and 4000),
  created_at timestamptz not null default now(),
  unique (session_id, turn_index)
);

create index academy_roleplay_messages_session_idx
  on public.academy_roleplay_messages (session_id, turn_index);

comment on table public.academy_roleplay_messages is
  'PHASE 17.8 / ADV-108: the real roleplay transcript. Append-only — '
  'written only through submit_academy_roleplay_turn below, which always '
  'inserts the advisor turn and the AI persona reply together so a '
  '"persona" row can never exist without the real advisor line that '
  'prompted it.';

alter table public.academy_roleplay_messages enable row level security;
revoke all on table public.academy_roleplay_messages from anon;

create policy "advisors read own roleplay messages"
  on public.academy_roleplay_messages for select to authenticated
  using (
    exists (
      select 1 from public.academy_roleplay_sessions sess
      join public.retailer_staff_members s on s.id = sess.staff_id
      where sess.id = academy_roleplay_messages.session_id
        and s.user_id = (select auth.uid())
        and s.deleted_at is null
    )
  );

create policy "managers read tenant roleplay messages"
  on public.academy_roleplay_messages for select to authenticated
  using (
    exists (
      select 1 from public.academy_roleplay_sessions sess
      where sess.id = academy_roleplay_messages.session_id
        and sess.retailer_id = (select public.current_retailer_id())
        and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "platform staff read roleplay messages"
  on public.academy_roleplay_messages for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.academy_roleplay_messages
  to authenticated, service_role;
grant all on table public.academy_roleplay_messages to service_role;

-- Links a grade to the real transcript it was graded from. Nullable — a
-- grade recorded from in-person/live observation still has no session.
-- Same-tenant validated below; not a hard FK-only guarantee because a
-- cross-tenant session_id must never be linkable even if the UUID exists.
alter table public.academy_roleplay_grades
  add column if not exists roleplay_session_id uuid
    references public.academy_roleplay_sessions (id) on delete set null;

comment on column public.academy_roleplay_grades.roleplay_session_id is
  'PHASE 17.8 / ADV-108. The real AI-roleplay session this grade reviewed, '
  'when the grade came from a recorded transcript rather than in-person '
  'observation. Same-tenant enforced by academy_roleplay_grade_session_tenant_chk.';

create or replace function public.check_academy_roleplay_grade_session_tenant()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.roleplay_session_id is not null and not exists (
    select 1 from public.academy_roleplay_sessions sess
    where sess.id = new.roleplay_session_id
      and sess.retailer_id = new.retailer_id
  ) then
    raise exception 'roleplay_session_id must belong to the same retailer as the grade';
  end if;
  return new;
end;
$$;

revoke all on function public.check_academy_roleplay_grade_session_tenant()
  from public;

create trigger academy_roleplay_grade_session_tenant_chk
  before insert or update of roleplay_session_id, retailer_id
  on public.academy_roleplay_grades
  for each row execute function public.check_academy_roleplay_grade_session_tenant();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Starts (or resumes) the calling advisor's one active session. Re-derives
-- the caller's own staff membership server-side — a client cannot start a
-- session on another advisor's behalf.
create or replace function public.start_academy_roleplay_session(
  p_retailer_id uuid,
  p_persona_key text
)
returns public.academy_roleplay_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_staff_id uuid;
  v_row public.academy_roleplay_sessions%rowtype;
begin
  if p_persona_key not in (
    'first_time_buyer', 'browser', 'know_it_all', 'couple',
    'complaint_handling', 'white_glove'
  ) then
    raise exception 'Unknown persona';
  end if;

  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select s.id into v_staff_id
  from public.retailer_staff_members s
  where s.user_id = auth.uid()
    and s.retailer_id = p_retailer_id
    and s.deleted_at is null
    and s.accepted_at is not null;

  if v_staff_id is null then
    raise exception 'Not an accepted staff member of this retailer';
  end if;

  select * into v_row
  from public.academy_roleplay_sessions
  where staff_id = v_staff_id and status = 'active';

  if found then
    return v_row;
  end if;

  insert into public.academy_roleplay_sessions (retailer_id, staff_id, persona_key)
  values (p_retailer_id, v_staff_id, p_persona_key)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.start_academy_roleplay_session(uuid, text) from public;
grant execute on function public.start_academy_roleplay_session(uuid, text)
  to authenticated;

-- Appends one real advisor line and its real AI persona reply together,
-- atomically, in order. The AI reply is computed by the caller (the
-- Server Action, after a real provider call) and passed in as text —
-- this RPC only re-derives ownership/session-active state and enforces
-- strict turn ordering; it never calls a provider itself.
create or replace function public.submit_academy_roleplay_turn(
  p_session_id uuid,
  p_advisor_text text,
  p_persona_text text
)
returns setof public.academy_roleplay_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.academy_roleplay_sessions%rowtype;
  v_next_turn integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if btrim(coalesce(p_advisor_text, '')) = '' then
    raise exception 'Advisor line cannot be empty';
  end if;
  if btrim(coalesce(p_persona_text, '')) = '' then
    raise exception 'Persona reply cannot be empty';
  end if;

  select sess.* into v_session
  from public.academy_roleplay_sessions sess
  join public.retailer_staff_members s on s.id = sess.staff_id
  where sess.id = p_session_id
    and s.user_id = auth.uid()
    and s.deleted_at is null
  for update of sess;

  if not found then
    raise exception 'Session not found or not owned by the caller';
  end if;
  if v_session.status <> 'active' then
    raise exception 'Session is not active';
  end if;

  v_next_turn := v_session.turn_count;

  insert into public.academy_roleplay_messages (session_id, turn_index, speaker, content)
  values
    (p_session_id, v_next_turn, 'advisor', p_advisor_text),
    (p_session_id, v_next_turn + 1, 'persona', p_persona_text);

  update public.academy_roleplay_sessions
  set turn_count = v_next_turn + 2
  where id = p_session_id;

  return query
    select * from public.academy_roleplay_messages
    where session_id = p_session_id and turn_index in (v_next_turn, v_next_turn + 1)
    order by turn_index;
end;
$$;

revoke all on function public.submit_academy_roleplay_turn(uuid, text, text) from public;
grant execute on function public.submit_academy_roleplay_turn(uuid, text, text)
  to authenticated;

create or replace function public.end_academy_roleplay_session(
  p_session_id uuid,
  p_status text
)
returns public.academy_roleplay_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.academy_roleplay_sessions%rowtype;
begin
  if p_status not in ('completed', 'abandoned') then
    raise exception 'Invalid terminal status';
  end if;
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.academy_roleplay_sessions sess
  set status = p_status, ended_at = now()
  from public.retailer_staff_members s
  where sess.id = p_session_id
    and s.id = sess.staff_id
    and s.user_id = auth.uid()
    and s.deleted_at is null
    and sess.status = 'active'
  returning sess.* into v_row;

  if not found then
    raise exception 'Session not found, not owned by the caller, or already ended';
  end if;

  return v_row;
end;
$$;

revoke all on function public.end_academy_roleplay_session(uuid, text) from public;
grant execute on function public.end_academy_roleplay_session(uuid, text)
  to authenticated;

alter type public.ai_generation_kind add value if not exists 'academy_roleplay';
