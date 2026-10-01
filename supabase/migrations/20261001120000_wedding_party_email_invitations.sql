-- Tailoring Party invitations sent by the platform, not the organizer's own
-- mail app.
--
-- The organizer's Server Action proves who they are with their own session
-- (RLS read of the party, organizer check), then calls
-- invite_wedding_party_guest() with the service role. The function re-checks
-- that the named customer organizes the party, queues the email in
-- email_outbox (ADR-032: drained by the dispatch cron) and records the
-- invitation. Only the service role may call it, so the email subject and
-- body — composed and escaped on the server — can never be supplied by a
-- browser.
--
-- An invitation creates no customer and no member: the guest becomes a
-- member only by opening the link (join_wedding_party). So an organizer can
-- neither enrol an existing customer nor fill the retailer's CRM.
--
-- Limits hold across parties, because parties are cheap to create: per
-- organizer 40 a day, per address 1 an hour and 3 a day, per retailer 500 a
-- day, and an organizer creates at most 5 parties a day. An address whose
-- customer opted out of email, or that has hard-bounced, is not mailed.

create table if not exists public.wedding_party_invitations (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  wedding_party_id uuid not null references public.wedding_parties (id) on delete cascade,
  organizer_customer_id uuid not null references public.customers (id) on delete cascade,
  guest_name text not null check (char_length(guest_name) between 1 and 200),
  email text not null check (char_length(email) between 3 and 320),
  email_outbox_id uuid references public.email_outbox (id) on delete set null,
  sent_at timestamptz not null default now()
);

create index if not exists wedding_party_invitations_party_idx
  on public.wedding_party_invitations (wedding_party_id, sent_at desc);
create index if not exists wedding_party_invitations_organizer_idx
  on public.wedding_party_invitations (organizer_customer_id, sent_at desc);
create index if not exists wedding_party_invitations_email_idx
  on public.wedding_party_invitations (retailer_id, email, sent_at desc);

alter table public.wedding_party_invitations enable row level security;

revoke all on table public.wedding_party_invitations from public, anon, authenticated;
grant select on table public.wedding_party_invitations to authenticated;
grant all on table public.wedding_party_invitations to service_role;

create policy "organizer reads own party invitations"
  on public.wedding_party_invitations for select
  using (
    exists (
      select 1
        from public.customers c
        where c.id = wedding_party_invitations.organizer_customer_id
          and c.user_id = auth.uid()
          and c.deleted_at is null
    )
  );

create policy "staff read their retailer's party invitations"
  on public.wedding_party_invitations for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
  );

-- Parties are free to create, so they are limited too.
create or replace function public.wedding_parties_creation_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from public.wedding_parties
      where organizer_customer_id = new.organizer_customer_id
        and created_at > now() - interval '1 day'
  ) >= 5 then
    raise exception 'Too many parties created today';
  end if;
  return new;
end;
$$;

revoke all on function public.wedding_parties_creation_limit() from public, anon, authenticated;

drop trigger if exists wedding_parties_creation_limit on public.wedding_parties;
create trigger wedding_parties_creation_limit
  before insert on public.wedding_parties
  for each row execute function public.wedding_parties_creation_limit();

create or replace function public.invite_wedding_party_guest(
  p_wedding_party_id uuid,
  p_organizer_customer_id uuid,
  p_name text,
  p_email text,
  p_subject text,
  p_html_body text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_party public.wedding_parties%rowtype;
  v_email text := lower(btrim(p_email));
  v_name text := btrim(p_name);
  v_outbox_id uuid;
  v_invitation_id uuid;
begin
  select * into v_party
    from public.wedding_parties
    where id = p_wedding_party_id
      and deleted_at is null
      and status <> 'cancelled';
  if not found or v_party.organizer_customer_id <> p_organizer_customer_id then
    raise exception 'Only the organizer can invite to this party';
  end if;

  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > 200 then
    raise exception 'Name must be 1 to 200 characters';
  end if;
  if v_email is null
    or char_length(v_email) > 320
    or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  then
    raise exception 'A valid email is required';
  end if;
  if p_subject is null or char_length(p_subject) not between 1 and 200
    or p_html_body is null or char_length(p_html_body) not between 1 and 5000
  then
    raise exception 'Invalid invitation';
  end if;

  -- Serialise one organizer's sends so the counts below cannot race.
  perform pg_advisory_xact_lock(hashtextextended(p_organizer_customer_id::text, 0));

  if (
    select count(*) from public.wedding_party_invitations
      where organizer_customer_id = p_organizer_customer_id
        and sent_at > now() - interval '1 day'
  ) >= 40 then
    raise exception 'Invitation limit reached for today';
  end if;
  if (
    select count(*) from public.wedding_party_invitations
      where retailer_id = v_party.retailer_id
        and sent_at > now() - interval '1 day'
  ) >= 500 then
    raise exception 'Invitation limit reached for today';
  end if;
  if exists (
    select 1 from public.wedding_party_invitations
      where retailer_id = v_party.retailer_id
        and email = v_email
        and sent_at > now() - interval '1 hour'
  ) or (
    select count(*) from public.wedding_party_invitations
      where retailer_id = v_party.retailer_id
        and email = v_email
        and sent_at > now() - interval '1 day'
  ) >= 3 then
    raise exception 'This address was invited recently';
  end if;

  -- Honour an existing customer's email opt-out and bounce suppression.
  if exists (
    select 1
      from public.customers c
      join public.customer_preferences cp on cp.customer_id = c.id
      where c.retailer_id = v_party.retailer_id
        and lower(c.email) = v_email
        and c.deleted_at is null
        and (
          not ('email' = any(cp.communication_channels))
          or cp.email_suppressed_at is not null
        )
  ) then
    raise exception 'This address cannot be invited';
  end if;

  insert into public.email_outbox (recipient_email, subject, html_body)
    values (v_email, p_subject, p_html_body)
    returning id into v_outbox_id;

  insert into public.wedding_party_invitations (
    retailer_id, wedding_party_id, organizer_customer_id, guest_name, email, email_outbox_id
  ) values (
    v_party.retailer_id, v_party.id, p_organizer_customer_id, v_name, v_email, v_outbox_id
  )
  returning id into v_invitation_id;

  return v_invitation_id;
end;
$$;

revoke all on function public.invite_wedding_party_guest(uuid, uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.invite_wedding_party_guest(uuid, uuid, text, text, text, text)
  to service_role;

comment on function public.invite_wedding_party_guest(uuid, uuid, text, text, text, text) is
  'Tailoring Party: queue a guest''s invitation email. Service role only; the caller has already proved the organizer''s session. Creates no customer or member; limits hold per organizer, address and retailer.';
