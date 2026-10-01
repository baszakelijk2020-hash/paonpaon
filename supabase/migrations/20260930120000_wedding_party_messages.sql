-- Tailoring party chat (founder direction 2026-09-30).
--
-- Everyone who holds the party's invite link — the organizer, joined guests,
-- and invitees still filling in their details — can read the party's
-- messages and post one. Access goes only through two narrow
-- security-definer functions keyed by that token: the same boundary
-- join_wedding_party and preview_wedding_party_invite already use (ADR-034:
-- no new anonymous RLS read/insert policy, narrow RPC only). RLS is enabled
-- with no policies, so the table itself is reachable by neither anon nor
-- authenticated.
--
-- Written to be re-runnable (if not exists / or replace): it may be applied
-- by hand to a local database before the migration runner reaches it.

create table if not exists public.wedding_party_messages (
  id uuid primary key default gen_random_uuid(),
  wedding_party_id uuid not null
    references public.wedding_parties (id) on delete cascade,
  author_name text not null,
  -- Set only when the poster is signed in as a customer of the party's
  -- retailer; what marks the organizer's own messages.
  author_customer_id uuid references public.customers (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint wedding_party_messages_author_name_chk
    check (char_length(btrim(author_name)) between 1 and 120),
  constraint wedding_party_messages_body_chk
    check (char_length(btrim(body)) between 1 and 1000)
);

create index if not exists wedding_party_messages_party_created_idx
  on public.wedding_party_messages (wedding_party_id, created_at);

alter table public.wedding_party_messages enable row level security;
revoke all on table public.wedding_party_messages from anon, authenticated;

-- The latest 200 messages, oldest first.
create or replace function public.list_wedding_party_messages(
  p_invite_token uuid
) returns table (
  id uuid,
  author_name text,
  body text,
  created_at timestamptz,
  is_organizer boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_party public.wedding_parties%rowtype;
begin
  select * into v_party
  from public.wedding_parties p
  where p.invite_token = p_invite_token
    and p.deleted_at is null
    and p.status <> 'cancelled';
  if not found then
    raise exception 'Invite link is no longer valid';
  end if;

  return query
    select m.id,
           m.author_name,
           m.body,
           m.created_at,
           coalesce(m.author_customer_id = v_party.organizer_customer_id, false)
    from (
      select x.*
      from public.wedding_party_messages x
      where x.wedding_party_id = v_party.id
      order by x.created_at desc
      limit 200
    ) m
    order by m.created_at asc;
end;
$$;

create or replace function public.post_wedding_party_message(
  p_invite_token uuid,
  p_author_name text,
  p_body text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_party public.wedding_parties%rowtype;
  v_customer_id uuid;
  v_recent integer;
  v_id uuid;
begin
  select * into v_party
  from public.wedding_parties p
  where p.invite_token = p_invite_token
    and p.deleted_at is null
    and p.status <> 'cancelled';
  if not found then
    raise exception 'Invite link is no longer valid';
  end if;

  if p_author_name is null
    or char_length(btrim(p_author_name)) < 1
    or char_length(p_author_name) > 120
  then
    raise exception 'Add your name first';
  end if;
  if p_body is null
    or char_length(btrim(p_body)) < 1
    or char_length(p_body) > 1000
  then
    raise exception 'Messages are 1 to 1000 characters';
  end if;

  -- A party-wide brake against a leaked link being used to flood the chat.
  select count(*) into v_recent
  from public.wedding_party_messages m
  where m.wedding_party_id = v_party.id
    and m.created_at > now() - interval '1 minute';
  if v_recent >= 30 then
    raise exception 'Too many messages just now, try again in a minute';
  end if;

  if auth.uid() is not null then
    select c.id into v_customer_id
    from public.customers c
    where c.user_id = auth.uid()
      and c.retailer_id = v_party.retailer_id
      and c.deleted_at is null
    limit 1;
  end if;

  insert into public.wedding_party_messages
    (wedding_party_id, author_name, author_customer_id, body)
  values
    (v_party.id, btrim(p_author_name), v_customer_id, btrim(p_body))
  returning wedding_party_messages.id into v_id;

  return v_id;
end;
$$;

revoke all on function public.list_wedding_party_messages(uuid) from public;
revoke all on function public.post_wedding_party_message(uuid, text, text)
  from public;
grant execute on function public.list_wedding_party_messages(uuid)
  to anon, authenticated, service_role;
grant execute on function public.post_wedding_party_message(uuid, text, text)
  to anon, authenticated, service_role;
