-- PHASE 11.4 (WFM-107): branch/HQ announcements, moderated learning
-- contributions, cross-location learning sessions, service-recovery budget
-- requests and a confidential support-resource catalogue.
--
-- The single most important thing about this migration is a table that is
-- NOT here. There is no support_resource_views, no support_resource_events
-- and no counter of any kind against `staff_support_resources`. The item
-- requires a confidential handoff and forbids exposing private support use;
-- an access log readable by managers defeats that outright, and one
-- readable by nobody is still a re-identification risk in a five-person
-- store and would still have to be disclosed. So usage is not observable —
-- see SUPPORT_RESOURCE_PRIVACY_NOTE in packages/domain, and the test that
-- fails if such a table is ever added.
--
-- Second: nothing here moves money. A service-recovery budget request is an
-- internal authorisation to spend up to an amount. ADR-062 and this item's
-- own non-goal both say no payout design exists yet, so there is no
-- provider reference, no payout column and no link to public.payments.

create table if not exists public.staff_announcements (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  -- null = the whole retailer (HQ). Non-null = one branch.
  branch_id uuid references public.retailer_branches (id) on delete cascade,
  -- Empty array = every role. Deliberately not null: an empty audience
  -- would silently hide an HQ safety notice.
  audience_roles text[] not null default '{}',
  title text not null check (char_length(btrim(title)) between 3 and 200),
  body text not null check (char_length(btrim(body)) between 10 and 20000),
  authored_by_staff_id uuid not null
    references public.retailer_staff_members (id) on delete cascade,
  published_at timestamptz,
  -- Announcements that must be acknowledged (a policy change) versus ones
  -- that are simply news. Acknowledgement is a receipt, never a metric.
  requires_acknowledgement boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint staff_announcements_branch_scope check (
    branch_id is not null or true
  )
);

create index if not exists staff_announcements_retailer_idx
  on public.staff_announcements (retailer_id, published_at desc)
  where deleted_at is null and published_at is not null;

create table if not exists public.staff_announcement_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  announcement_id uuid not null
    references public.staff_announcements (id) on delete cascade,
  staff_id uuid not null
    references public.retailer_staff_members (id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  -- One receipt per person per announcement. Without this a repeated page
  -- load would inflate a "reach" number that is supposed to be a fact.
  constraint staff_announcement_ack_unique unique (announcement_id, staff_id)
);

create table if not exists public.staff_learning_contributions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  author_staff_id uuid not null
    references public.retailer_staff_members (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 200),
  body text not null check (char_length(btrim(body)) between 40 and 20000),
  version integer not null default 1 check (version >= 1),
  state text not null default 'draft' check (
    state in ('draft', 'submitted', 'approved', 'rejected', 'withdrawn')
  ),
  moderated_by_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  moderated_at timestamptz,
  moderation_note text check (
    moderation_note is null
    or char_length(btrim(moderation_note)) between 1 and 2000
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Nobody moderates their own contribution. Enforced here as well as in
  -- the domain layer, because a direct PostgREST call never touches the
  -- domain layer.
  constraint staff_learning_no_self_moderation check (
    moderated_by_staff_id is null
    or moderated_by_staff_id <> author_staff_id
  ),
  constraint staff_learning_moderation_complete check (
    (state in ('approved', 'rejected'))
    = (moderated_by_staff_id is not null and moderated_at is not null)
  ),
  -- A rejection must say why. An anonymous veto teaches nothing.
  constraint staff_learning_rejection_has_reason check (
    state <> 'rejected' or moderation_note is not null
  ),
  constraint staff_learning_version_unique
    unique (retailer_id, author_staff_id, title, version)
);

create index if not exists staff_learning_moderation_queue_idx
  on public.staff_learning_contributions (retailer_id, created_at)
  where state = 'submitted' and deleted_at is null;

create table if not exists public.staff_learning_sessions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  -- Cross-location by design: a session hosted by one branch that others
  -- join. Null branch means every location.
  host_branch_id uuid references public.retailer_branches (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 3 and 200),
  description text check (description is null or char_length(description) <= 4000),
  starts_at timestamptz not null,
  -- A joining link, not a hosted video product. PAON is not becoming a
  -- conferencing platform; the retailer brings their own.
  join_url text check (join_url is null or char_length(join_url) <= 2000),
  contribution_id uuid
    references public.staff_learning_contributions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists staff_learning_sessions_upcoming_idx
  on public.staff_learning_sessions (retailer_id, starts_at)
  where deleted_at is null;

create table if not exists public.service_recovery_budget_requests (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  requested_by_staff_id uuid not null
    references public.retailer_staff_members (id) on delete cascade,
  -- Recovery is recovery FOR someone. A request attached to neither is
  -- petty cash, which is a different thing with different controls.
  customer_id uuid references public.customers (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  amount_minor_units integer not null check (amount_minor_units > 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  reason text not null check (char_length(btrim(reason)) between 10 and 2000),
  state text not null default 'requested' check (
    state in ('requested', 'approved', 'declined', 'spent')
  ),
  approved_by_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  decided_at timestamptz,
  decision_note text check (
    decision_note is null or char_length(btrim(decision_note)) <= 2000
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_recovery_has_context check (
    customer_id is not null or order_id is not null
  ),
  constraint service_recovery_no_self_approval check (
    approved_by_staff_id is null
    or approved_by_staff_id <> requested_by_staff_id
  ),
  constraint service_recovery_decision_complete check (
    (state in ('approved', 'declined'))
    = (approved_by_staff_id is not null and decided_at is not null)
  )
);

create index if not exists service_recovery_queue_idx
  on public.service_recovery_budget_requests (retailer_id, created_at)
  where state = 'requested';

create table if not exists public.staff_support_resources (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  resource_key text not null check (char_length(resource_key) between 2 and 64),
  title text not null check (char_length(btrim(title)) between 3 and 200),
  summary text not null check (char_length(btrim(summary)) between 10 and 4000),
  external_url text check (external_url is null or char_length(external_url) <= 2000),
  phone text check (phone is null or char_length(phone) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Unreachable help is worse than none: it looks like support and is not.
  constraint staff_support_reachable check (
    external_url is not null or phone is not null
  ),
  constraint staff_support_key_unique unique (retailer_id, resource_key)
);

create trigger set_staff_announcements_updated_at
  before update on public.staff_announcements
  for each row execute function public.set_updated_at();
create trigger set_staff_learning_contributions_updated_at
  before update on public.staff_learning_contributions
  for each row execute function public.set_updated_at();
create trigger set_staff_learning_sessions_updated_at
  before update on public.staff_learning_sessions
  for each row execute function public.set_updated_at();
create trigger set_service_recovery_budget_requests_updated_at
  before update on public.service_recovery_budget_requests
  for each row execute function public.set_updated_at();
create trigger set_staff_support_resources_updated_at
  before update on public.staff_support_resources
  for each row execute function public.set_updated_at();

alter table public.staff_announcements enable row level security;
alter table public.staff_announcement_acknowledgements enable row level security;
alter table public.staff_learning_contributions enable row level security;
alter table public.staff_learning_sessions enable row level security;
alter table public.service_recovery_budget_requests enable row level security;
alter table public.staff_support_resources enable row level security;

revoke all on table public.staff_announcements from public, anon;
revoke all on table public.staff_announcement_acknowledgements from public, anon;
revoke all on table public.staff_learning_contributions from public, anon;
revoke all on table public.staff_learning_sessions from public, anon;
revoke all on table public.service_recovery_budget_requests from public, anon;
revoke all on table public.staff_support_resources from public, anon;

grant select on table public.staff_announcements to authenticated, service_role;
grant select on table public.staff_announcement_acknowledgements
  to authenticated, service_role;
grant select on table public.staff_learning_contributions
  to authenticated, service_role;
grant select on table public.staff_learning_sessions to authenticated, service_role;
grant select on table public.service_recovery_budget_requests
  to authenticated, service_role;
grant select on table public.staff_support_resources to authenticated, service_role;

grant insert, update on table public.staff_announcements to authenticated, service_role;
grant insert on table public.staff_announcement_acknowledgements
  to authenticated, service_role;
grant insert, update on table public.staff_learning_contributions
  to authenticated, service_role;
grant insert, update on table public.staff_learning_sessions
  to authenticated, service_role;
grant insert, update on table public.service_recovery_budget_requests
  to authenticated, service_role;
grant insert, update on table public.staff_support_resources
  to service_role;

-- Audience filtering happens in the query, not in RLS: RLS scopes to the
-- tenant, and a branch/role predicate here would make an HQ announcement
-- invisible to a staff member whose branch assignment is still null.
create policy staff_announcements_retailer_select
  on public.staff_announcements for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );
create policy staff_announcements_manager_write
  on public.staff_announcements for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );
create policy staff_announcements_manager_update
  on public.staff_announcements for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  )
  with check (retailer_id = public.current_retailer_id());

-- You may record only your OWN receipt. Otherwise a manager could mark the
-- team as having read a policy none of them saw.
create policy staff_announcement_ack_self_insert
  on public.staff_announcement_acknowledgements for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and exists (
      select 1 from public.retailer_staff_members m
      where m.id = staff_id
        and m.retailer_id = public.current_retailer_id()
        and m.user_id = (select auth.uid())
        and m.deleted_at is null
    )
  );
create policy staff_announcement_ack_retailer_select
  on public.staff_announcement_acknowledgements for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

-- Only approved contributions are visible to the floor; an author always
-- sees their own drafts; managers see the moderation queue. A rejected
-- draft is not published reading material.
create policy staff_learning_visible_select
  on public.staff_learning_contributions for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and (
      state = 'approved'
      or public.current_retailer_role() in ('owner', 'manager', 'admin')
      or exists (
        select 1 from public.retailer_staff_members m
        where m.id = author_staff_id
          and m.retailer_id = public.current_retailer_id()
          and m.user_id = (select auth.uid())
          and m.deleted_at is null
      )
    )
  );
create policy staff_learning_author_insert
  on public.staff_learning_contributions for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and exists (
      select 1 from public.retailer_staff_members m
      where m.id = author_staff_id
        and m.retailer_id = public.current_retailer_id()
        and m.user_id = (select auth.uid())
        and m.deleted_at is null
    )
  );
create policy staff_learning_author_or_moderator_update
  on public.staff_learning_contributions for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and (
      public.current_retailer_role() in ('owner', 'manager', 'admin')
      or exists (
        select 1 from public.retailer_staff_members m
        where m.id = author_staff_id
          and m.retailer_id = public.current_retailer_id()
          and m.user_id = (select auth.uid())
          and m.deleted_at is null
      )
    )
  )
  with check (retailer_id = public.current_retailer_id());

create policy staff_learning_sessions_retailer_select
  on public.staff_learning_sessions for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );
create policy staff_learning_sessions_manager_write
  on public.staff_learning_sessions for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );
create policy staff_learning_sessions_manager_update
  on public.staff_learning_sessions for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  )
  with check (retailer_id = public.current_retailer_id());

-- A budget request names a customer and an amount, so it is NOT
-- retailer-wide readable: the requester and approvers only.
create policy service_recovery_requester_or_manager_select
  on public.service_recovery_budget_requests for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and (
      public.current_retailer_role() in ('owner', 'manager', 'admin')
      or exists (
        select 1 from public.retailer_staff_members m
        where m.id = requested_by_staff_id
          and m.retailer_id = public.current_retailer_id()
          and m.user_id = (select auth.uid())
          and m.deleted_at is null
      )
    )
  );
create policy service_recovery_requester_insert
  on public.service_recovery_budget_requests for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and exists (
      select 1 from public.retailer_staff_members m
      where m.id = requested_by_staff_id
        and m.retailer_id = public.current_retailer_id()
        and m.user_id = (select auth.uid())
        and m.deleted_at is null
    )
  );
create policy service_recovery_manager_decide
  on public.service_recovery_budget_requests for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

-- Readable by everyone in the retailer, writable by nobody through a
-- session. The catalogue is curated by the platform/HQ, and — critically —
-- reading it leaves no trace, because there is no table in which to leave
-- one.
create policy staff_support_resources_retailer_select
  on public.staff_support_resources for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

comment on table public.staff_support_resources is
  'PHASE 11.4 / WFM-107 confidential support catalogue. There is '
  'deliberately NO usage log, view counter or access event anywhere for '
  'this table: a confidential handoff that leaves an audit trail is not '
  'confidential.';
comment on table public.service_recovery_budget_requests is
  'PHASE 11.4 internal spend authorisation only. Moves no money and names '
  'no payment provider - ADR-062 has not decided a payout design.';
