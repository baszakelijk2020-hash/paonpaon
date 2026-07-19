-- Lets a retailer's own owner/admin edit their tenant's business
-- profile from Retailer Portal settings (docs/PRODUCT.md "Retailer
-- Portal" > Settings), without granting them write access to the
-- platform-controlled columns (`status`, `tier`, `slug`,
-- `default_currency`) that PAON Admin and internal flows (e.g.
-- `accept_retailer_staff_invite`) own. RLS alone can't express
-- "this column may not change" — WITH CHECK only sees the candidate
-- new row, not the old one — so a BEFORE UPDATE trigger enforces it,
-- the same reasoning as the claim-sync triggers in
-- create_platform_staff_members / create_retailer_staff_members.

create policy "retailer owners and admins can update their own retailer"
  on public.retailers for update
  using (
    id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'admin')
  )
  with check (
    id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'admin')
  );

create or replace function public.enforce_retailer_staff_editable_columns()
returns trigger
language plpgsql
as $$
begin
  -- Three privileged paths, none of which is "a retailer staff member
  -- updating their own tenant directly":
  --   1. auth.role() = 'service_role' — the admin/service-role client
  --      (bootstrap scripts, future cron/internal jobs). Triggers
  --      always fire regardless of RLS, so service_role's RLS bypass
  --      (BYPASSRLS) does not, by itself, exempt it here.
  --   2. current_user <> session_user — a security definer function
  --      (e.g. accept_retailer_staff_invite) runs with current_user
  --      switched to its owner while session_user stays the connecting
  --      role for the whole session; auth.role() still reports the
  --      original caller's JWT role in this case, so this check is the
  --      one that catches it.
  --   3. public.is_platform_staff() — a PAON Admin operator's own
  --      RLS-enforced session.
  if auth.role() = 'service_role'
    or current_user <> session_user
    or public.is_platform_staff()
  then
    return new;
  end if;

  if new.status is distinct from old.status
    or new.tier is distinct from old.tier
    or new.slug is distinct from old.slug
    or new.default_currency is distinct from old.default_currency
  then
    raise exception
      'Retailer staff may only update business profile fields — status, tier, slug and default_currency are platform-controlled';
  end if;

  return new;
end;
$$;

create trigger enforce_retailer_staff_editable_columns_on_update
  before update on public.retailers
  for each row
  execute function public.enforce_retailer_staff_editable_columns();
