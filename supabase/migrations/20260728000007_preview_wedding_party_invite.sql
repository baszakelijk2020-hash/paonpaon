-- Public join-page preview: safe fields only, no organizer PII.
-- Same narrow security-definer pattern as join_wedding_party (ADR-034).

create or replace function public.preview_wedding_party_invite(
  p_invite_token uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_party public.wedding_parties%rowtype;
  v_retailer_name text;
  v_retailer_slug text;
begin
  select * into v_party
  from public.wedding_parties
  where invite_token = p_invite_token
    and deleted_at is null
    and status <> 'cancelled';
  if not found then
    raise exception 'Invite link is no longer valid';
  end if;

  select display_name, slug into v_retailer_name, v_retailer_slug
  from public.retailers
  where id = v_party.retailer_id;

  return jsonb_build_object(
    'retailer_name', coalesce(v_retailer_name, 'Your atelier'),
    'retailer_slug', v_retailer_slug,
    'event_date', v_party.event_date,
    'event_time', case
      when v_party.event_time is null then null
      else to_char(v_party.event_time, 'HH24:MI')
    end,
    'venue_name', v_party.venue_name,
    'fitting_location', v_party.fitting_location
  );
end;
$$;

revoke all on function public.preview_wedding_party_invite(uuid) from public;
grant execute on function public.preview_wedding_party_invite(uuid)
  to anon, authenticated, service_role;
