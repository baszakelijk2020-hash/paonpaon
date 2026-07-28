-- Join-flow preparation fields (PHASE.md queue item 6 step 6).
-- height_cm / weight_kg are party-scoped coordination data on the
-- member row — not a CustomerFitProfile (ADR-055). Photo URL may be
-- set by the join action after upload (service role) or later by the
-- organizer.

alter table public.wedding_party_members
  add column height_cm numeric(5, 1),
  add column weight_kg numeric(5, 1);

alter table public.wedding_party_members
  add constraint wedding_party_members_height_cm_check
    check (height_cm is null or (height_cm >= 100 and height_cm <= 250)),
  add constraint wedding_party_members_weight_kg_check
    check (weight_kg is null or (weight_kg >= 30 and weight_kg <= 300));

-- Replace the identity-only join RPC with one that also accepts
-- preparation fields. Drop the old signature first.
drop function if exists public.join_wedding_party(
  uuid, text, text, public.wedding_party_member_role
);

create or replace function public.join_wedding_party(
  p_invite_token uuid,
  p_name text,
  p_email text,
  p_role public.wedding_party_member_role,
  p_height_cm numeric,
  p_weight_kg numeric,
  p_photo_url text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_party public.wedding_parties%rowtype;
  v_email text := lower(trim(p_email));
  v_customer_id uuid;
  v_member_id uuid;
begin
  select * into v_party
  from public.wedding_parties
  where invite_token = p_invite_token and deleted_at is null and status <> 'cancelled';
  if not found then
    raise exception 'Invite link is no longer valid';
  end if;

  if p_name is null or char_length(trim(p_name)) < 1 or char_length(p_name) > 200 then
    raise exception 'Name must be 1 to 200 characters';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'A valid email is required';
  end if;
  if p_height_cm is null or p_height_cm < 100 or p_height_cm > 250 then
    raise exception 'Height must be between 100 and 250 cm';
  end if;
  if p_weight_kg is null or p_weight_kg < 30 or p_weight_kg > 300 then
    raise exception 'Weight must be between 30 and 300 kg';
  end if;
  if p_photo_url is not null and char_length(p_photo_url) > 2000 then
    raise exception 'Photo URL is too long';
  end if;

  select id into v_customer_id from public.customers
    where retailer_id = v_party.retailer_id and lower(email) = v_email and deleted_at is null
    limit 1;

  if v_customer_id is null then
    insert into public.customers (retailer_id, full_name, email, lifecycle_stage, acquisition_source)
      values (v_party.retailer_id, trim(p_name), v_email, 'prospect', 'wedding_party_invite')
      returning id into v_customer_id;
  end if;

  insert into public.wedding_party_members (
    wedding_party_id, customer_id, name, role, height_cm, weight_kg, photo_url
  )
    values (
      v_party.id,
      v_customer_id,
      trim(p_name),
      p_role,
      p_height_cm,
      p_weight_kg,
      nullif(trim(p_photo_url), '')
    )
    on conflict (wedding_party_id, customer_id) do update set
      role = excluded.role,
      name = excluded.name,
      height_cm = excluded.height_cm,
      weight_kg = excluded.weight_kg,
      photo_url = coalesce(excluded.photo_url, public.wedding_party_members.photo_url)
    returning id into v_member_id;

  return jsonb_build_object(
    'member_id', v_member_id,
    'party_id', v_party.id,
    'retailer_id', v_party.retailer_id
  );
end;
$$;

revoke all on function public.join_wedding_party(
  uuid, text, text, public.wedding_party_member_role, numeric, numeric, text
) from public;
grant execute on function public.join_wedding_party(
  uuid, text, text, public.wedding_party_member_role, numeric, numeric, text
) to anon, authenticated, service_role;
