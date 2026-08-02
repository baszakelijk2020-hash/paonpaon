-- FT-13 Moonstruck groom/best-men planner — "group-date agreement". No
-- schema existed for this at all (unlike group_fittings/inspiration_items/
-- design_choices, which only needed wiring). The organizer or any member
-- proposes a candidate date; every member votes; the organizer finalizes by
-- setting wedding_parties.event_date — which already has a working RLS
-- update path for the organizer (20260728000005's "organizer updates own
-- wedding party"), so finalization is a plain repository update, not a new
-- RPC.

create table public.wedding_date_candidates (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  wedding_party_id uuid not null
    references public.wedding_parties (id) on delete cascade,
  candidate_date date not null,
  created_at timestamptz not null default now(),
  unique (wedding_party_id, candidate_date)
);

create table public.wedding_date_votes (
  wedding_date_candidate_id uuid not null
    references public.wedding_date_candidates (id) on delete cascade,
  wedding_party_member_id uuid not null
    references public.wedding_party_members (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wedding_date_candidate_id, wedding_party_member_id)
);

alter table public.wedding_date_candidates enable row level security;
alter table public.wedding_date_votes enable row level security;

create policy "organizer and members read their party's date candidates"
  on public.wedding_date_candidates for select
  using (public.is_wedding_party_organizer_or_member(wedding_party_id));

create policy "organizer and members read their party's date votes"
  on public.wedding_date_votes for select
  using (
    exists (
      select 1 from public.wedding_date_candidates c
      where c.id = wedding_date_votes.wedding_date_candidate_id
        and public.is_wedding_party_organizer_or_member(c.wedding_party_id)
    )
  );

grant select on public.wedding_date_candidates, public.wedding_date_votes
  to authenticated, service_role;

comment on table public.wedding_date_candidates is
  'Written only by propose_wedding_date_candidate().';
comment on table public.wedding_date_votes is
  'Written only by toggle_wedding_date_vote().';

create or replace function public.propose_wedding_date_candidate(
  p_wedding_party_id uuid,
  p_candidate_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retailer_id uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_wedding_party_organizer_or_member(p_wedding_party_id) then
    raise exception 'Not authorized for this wedding party';
  end if;

  select retailer_id into v_retailer_id
    from public.wedding_parties where id = p_wedding_party_id;

  insert into public.wedding_date_candidates
    (retailer_id, wedding_party_id, candidate_date)
    values (v_retailer_id, p_wedding_party_id, p_candidate_date)
    on conflict (wedding_party_id, candidate_date) do nothing
    returning id into v_id;

  if v_id is null then
    select id into v_id from public.wedding_date_candidates
      where wedding_party_id = p_wedding_party_id
        and candidate_date = p_candidate_date;
  end if;

  return v_id;
end;
$$;

revoke all on function public.propose_wedding_date_candidate(uuid, date) from public;
grant execute on function public.propose_wedding_date_candidate(uuid, date)
  to authenticated, service_role;

-- Toggles the caller's OWN vote (their own wedding_party_members row for
-- this party) — never a client-supplied member id, so a member can never
-- vote as someone else.
create or replace function public.toggle_wedding_date_vote(
  p_candidate_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wedding_party_id uuid;
  v_member_id uuid;
  v_removed boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select wedding_party_id into v_wedding_party_id
    from public.wedding_date_candidates where id = p_candidate_id;
  if v_wedding_party_id is null then
    raise exception 'Candidate date not found';
  end if;

  select m.id into v_member_id
    from public.wedding_party_members m
    join public.customers c on c.id = m.customer_id
    where m.wedding_party_id = v_wedding_party_id and c.user_id = auth.uid()
    limit 1;
  if v_member_id is null then
    raise exception 'Only a party member can vote';
  end if;

  if exists (
    select 1 from public.wedding_date_votes
    where wedding_date_candidate_id = p_candidate_id
      and wedding_party_member_id = v_member_id
  ) then
    delete from public.wedding_date_votes
      where wedding_date_candidate_id = p_candidate_id
        and wedding_party_member_id = v_member_id;
    v_removed := true;
  else
    insert into public.wedding_date_votes
      (wedding_date_candidate_id, wedding_party_member_id)
      values (p_candidate_id, v_member_id);
  end if;

  return not v_removed;
end;
$$;

revoke all on function public.toggle_wedding_date_vote(uuid) from public;
grant execute on function public.toggle_wedding_date_vote(uuid)
  to authenticated, service_role;
