-- Groom-shareable invite links: the organizer sends one link to the
-- whole party instead of a sales associate typing in every member's
-- name and email by hand. Anonymous join, same shape as
-- submit_table_service_inquiry (ADR-034) — a single narrow
-- security-definer entry point, no anonymous RLS insert policy.

alter table public.wedding_parties
  add column invite_token uuid not null default gen_random_uuid() unique;

create index wedding_parties_invite_token_idx on public.wedding_parties (invite_token);

create or replace function public.join_wedding_party(
  p_invite_token uuid,
  p_name text,
  p_email text,
  p_role public.wedding_party_member_role
) returns uuid
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

  select id into v_customer_id from public.customers
    where retailer_id = v_party.retailer_id and lower(email) = v_email and deleted_at is null
    limit 1;

  if v_customer_id is null then
    insert into public.customers (retailer_id, full_name, email, lifecycle_stage, acquisition_source)
      values (v_party.retailer_id, trim(p_name), v_email, 'prospect', 'wedding_party_invite')
      returning id into v_customer_id;
  end if;

  insert into public.wedding_party_members (wedding_party_id, customer_id, name, role)
    values (v_party.id, v_customer_id, trim(p_name), p_role)
    on conflict (wedding_party_id, customer_id) do update set role = excluded.role
    returning id into v_member_id;

  return v_member_id;
end;
$$;

revoke all on function public.join_wedding_party(
  uuid, text, text, public.wedding_party_member_role
) from public;
grant execute on function public.join_wedding_party(
  uuid, text, text, public.wedding_party_member_role
) to anon, authenticated, service_role;
