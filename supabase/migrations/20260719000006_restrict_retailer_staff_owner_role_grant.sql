-- Closes a privilege-escalation gap the existing "retailer owners and
-- admins can manage their retailer's staff" policy
-- (create_retailer_staff_members migration) leaves open now that
-- in-portal staff invites exist: that policy's WITH CHECK only
-- verifies the caller is an owner/admin of the target retailer, not
-- that the role they're granting is one they're allowed to grant — an
-- "admin" could otherwise insert a new row with role = 'owner' and
-- hand themselves (or anyone) ownership. Provisioning the sole owner
-- is exclusively a PAON Admin action folded into retailer creation —
-- see docs/DECISIONS.md ADR-009 — and Retailer Portal's own invite
-- form/Server Action already enforces this at the application layer
-- via `INVITABLE_RETAILER_ROLES` (@paon/domain). This restrictive
-- policy is the matching database-layer enforcement docs/DATABASE.md
-- requires ("the application-layer guard ... and the database policy
-- must enforce the same rule") — a RESTRICTIVE policy, not a change to
-- the existing permissive one, so it narrows only INSERT and leaves
-- every other permission that policy grants untouched.

create policy "retailer staff invites may not grant owner role"
  as restrictive
  on public.retailer_staff_members for insert
  with check (
    public.is_platform_staff()
    or role <> 'owner'
  );
