-- Wedding Party (ADR-035, overriding ADR-034's earlier deferral of the
-- deck's "Moonstruck" concept): an organizer and their invited party
-- members, each getting a real Customer identity, staff tracking
-- fitting progress across the group. Scoped to coordination only.

create type public.wedding_party_status as enum (
  'planning', 'confirmed', 'completed', 'cancelled'
);

create type public.wedding_party_member_role as enum (
  'groom', 'best_man', 'groomsman', 'father_of_groom', 'other'
);

create type public.wedding_party_member_fitting_status as enum (
  'invited', 'scheduled', 'fitted', 'completed'
);

create table public.wedding_parties (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  organizer_customer_id uuid not null references public.customers (id) on delete cascade,
  event_date date,
  venue_name text,
  status public.wedding_party_status not null default 'planning',
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index wedding_parties_retailer_idx on public.wedding_parties (retailer_id);
create index wedding_parties_organizer_idx on public.wedding_parties (organizer_customer_id);
create trigger set_wedding_parties_updated_at
  before update on public.wedding_parties
  for each row execute function public.set_updated_at();

create table public.wedding_party_members (
  id uuid primary key default gen_random_uuid(),
  wedding_party_id uuid not null references public.wedding_parties (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  role public.wedding_party_member_role not null default 'other',
  fitting_status public.wedding_party_member_fitting_status not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (wedding_party_id, customer_id)
);
create index wedding_party_members_party_idx on public.wedding_party_members (wedding_party_id);
create index wedding_party_members_customer_idx on public.wedding_party_members (customer_id);
create trigger set_wedding_party_members_updated_at
  before update on public.wedding_party_members
  for each row execute function public.set_updated_at();

alter table public.wedding_parties enable row level security;
alter table public.wedding_party_members enable row level security;

create policy "platform reads wedding parties" on public.wedding_parties
  for select using (public.is_platform_staff());

create policy "retailer staff manage wedding parties" on public.wedding_parties
  for all
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
  );

create policy "organizer and members read their wedding party" on public.wedding_parties
  for select using (
    exists (
      select 1 from public.customers c
      where c.id = organizer_customer_id and c.user_id = auth.uid()
    )
    or exists (
      select 1 from public.wedding_party_members m
      join public.customers c on c.id = m.customer_id
      where m.wedding_party_id = wedding_parties.id and c.user_id = auth.uid()
    )
  );

create policy "platform reads wedding party members" on public.wedding_party_members
  for select using (public.is_platform_staff());

create policy "retailer staff manage wedding party members" on public.wedding_party_members
  for all
  using (
    exists (
      select 1 from public.wedding_parties p
      where p.id = wedding_party_id
        and p.retailer_id = public.current_retailer_id()
        and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
    )
  )
  with check (
    exists (
      select 1 from public.wedding_parties p
      where p.id = wedding_party_id
        and p.retailer_id = public.current_retailer_id()
        and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
    )
  );

create policy "organizer and members read the roster" on public.wedding_party_members
  for select using (
    exists (
      select 1 from public.wedding_parties p
      join public.customers oc on oc.id = p.organizer_customer_id
      where p.id = wedding_party_members.wedding_party_id and oc.user_id = auth.uid()
    )
    or exists (
      select 1 from public.wedding_party_members m2
      join public.customers c2 on c2.id = m2.customer_id
      where m2.wedding_party_id = wedding_party_members.wedding_party_id
        and c2.user_id = auth.uid()
    )
  );

grant select, insert, update on public.wedding_parties, public.wedding_party_members
  to authenticated, service_role;

-- Transactional find-or-create-guest-customer + add-member, same
-- reasoning as `place_order` for "two tables written from one call."
create or replace function public.add_wedding_party_member(
  p_wedding_party_id uuid,
  p_name text,
  p_email text,
  p_role public.wedding_party_member_role
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retailer_id uuid;
  v_email text := lower(trim(p_email));
  v_customer_id uuid;
  v_member_id uuid;
begin
  select p.retailer_id into v_retailer_id
  from public.wedding_parties p
  where p.id = p_wedding_party_id and p.deleted_at is null;

  if v_retailer_id is null
    or v_retailer_id <> public.current_retailer_id()
    or public.current_retailer_role() not in ('sales_associate', 'manager', 'admin', 'owner')
  then
    raise exception 'Not authorized';
  end if;

  if p_name is null or char_length(trim(p_name)) < 1 or char_length(p_name) > 200 then
    raise exception 'Name must be 1 to 200 characters';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'A valid email is required';
  end if;

  select id into v_customer_id from public.customers
    where retailer_id = v_retailer_id and lower(email) = v_email and deleted_at is null
    limit 1;

  if v_customer_id is null then
    insert into public.customers (retailer_id, full_name, email, lifecycle_stage, acquisition_source)
      values (v_retailer_id, trim(p_name), v_email, 'prospect', 'wedding_party')
      returning id into v_customer_id;
  end if;

  insert into public.wedding_party_members (wedding_party_id, customer_id, name, role)
    values (p_wedding_party_id, v_customer_id, trim(p_name), p_role)
    on conflict (wedding_party_id, customer_id) do update set role = excluded.role
    returning id into v_member_id;

  return v_member_id;
end;
$$;

revoke all on function public.add_wedding_party_member(
  uuid, text, text, public.wedding_party_member_role
) from public;
grant execute on function public.add_wedding_party_member(
  uuid, text, text, public.wedding_party_member_role
) to authenticated, service_role;

-- Narrow state transition a member can trigger about themselves
-- (self-report "I've booked my fitting"), same "security definer RPC
-- over a broadened RLS policy" shape as get_or_create_my_conversation.
-- Staff may set any status; a member may only set their own row to
-- 'scheduled' — 'fitted'/'completed' stay a staff sign-off.
create or replace function public.update_wedding_party_member_status(
  p_member_id uuid,
  p_status public.wedding_party_member_fitting_status
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.wedding_party_members%rowtype;
  v_retailer_id uuid;
  v_is_staff boolean;
begin
  select * into v_member from public.wedding_party_members where id = p_member_id and deleted_at is null;
  if not found then
    raise exception 'Member not found';
  end if;

  select p.retailer_id into v_retailer_id from public.wedding_parties p where p.id = v_member.wedding_party_id;
  v_is_staff := v_retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner');

  if v_is_staff then
    update public.wedding_party_members set fitting_status = p_status where id = p_member_id;
  elsif exists (
    select 1 from public.customers c where c.id = v_member.customer_id and c.user_id = auth.uid()
  ) then
    if p_status <> 'scheduled' then
      raise exception 'Members may only mark their own fitting as scheduled';
    end if;
    update public.wedding_party_members set fitting_status = p_status where id = p_member_id;
  else
    raise exception 'Not authorized';
  end if;
end;
$$;

revoke all on function public.update_wedding_party_member_status(
  uuid, public.wedding_party_member_fitting_status
) from public;
grant execute on function public.update_wedding_party_member_status(
  uuid, public.wedding_party_member_fitting_status
) to authenticated, service_role;
