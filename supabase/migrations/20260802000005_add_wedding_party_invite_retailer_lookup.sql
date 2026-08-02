-- joinWeddingParty (apps/customer) is the only anonymous entry point that
-- resolves its retailer purely as a side effect of the write itself
-- (join_wedding_party's SECURITY DEFINER body), so it could not check
-- enterprise_verticals module state before writing. This read-only lookup
-- mirrors join_wedding_party's own token validity check without performing
-- the join, so the caller can gate first. Exposes nothing beyond what the
-- join RPC itself already reveals to an anonymous holder of the token: which
-- retailer a valid invite belongs to.
create or replace function public.wedding_party_retailer_for_invite(
  p_invite_token uuid
)
returns uuid
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select retailer_id
  from public.wedding_parties
  where invite_token = p_invite_token
    and deleted_at is null
    and status <> 'cancelled';
$$;

revoke all on function public.wedding_party_retailer_for_invite(uuid)
  from public;
grant execute on function public.wedding_party_retailer_for_invite(uuid)
  to anon, authenticated, service_role;
