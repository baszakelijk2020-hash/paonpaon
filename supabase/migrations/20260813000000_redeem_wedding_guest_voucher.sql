-- Moonstruck guest-voucher customer-facing redemption.
--
-- Staff already mark a guest voucher redeemed with a plain update trusted
-- because the caller is always a retailer-staff session (see
-- issueGuestVoucher/markGuestVoucherRedeemed comments in
-- wedding-party-repository.ts). A customer session cannot be trusted the
-- same way with a raw update: nothing stops one party's member from
-- updating another party's voucher by id. This RPC re-derives the caller's
-- party membership from auth.uid() via the existing
-- is_wedding_party_organizer_or_member() helper, locks the row, and
-- enforces the same "already redeemed"/expiry facts the staff flow leaves
-- to the UPDATE ... WHERE clause, so a customer session gets the same
-- guarantees explicitly instead of implicitly.

create or replace function public.redeem_wedding_guest_voucher(
  p_voucher_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_voucher public.wedding_guest_vouchers%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_voucher
    from public.wedding_guest_vouchers
    where id = p_voucher_id
    for update;
  if not found then
    raise exception 'Voucher not found';
  end if;

  if not public.is_wedding_party_organizer_or_member(v_voucher.wedding_party_id) then
    raise exception 'You are not part of this wedding party';
  end if;

  if v_voucher.redeemed_at is not null then
    raise exception 'This voucher has already been redeemed';
  end if;

  if v_voucher.expires_on < current_date then
    raise exception 'This voucher has expired';
  end if;

  update public.wedding_guest_vouchers
    set redeemed_at = now(),
        updated_at = now()
    where id = v_voucher.id;

  return jsonb_build_object('ok', true, 'voucherId', v_voucher.id);
end;
$$;

revoke all on function public.redeem_wedding_guest_voucher(uuid) from public;
grant execute on function public.redeem_wedding_guest_voucher(uuid)
  to authenticated;
