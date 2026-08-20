-- Second half of the retailer-onboarding fix (see
-- 20260820000000_fix_retailer_virtual_try_on_policy_trigger_grant.sql for
-- the first). Fixing that first bug unmasked a second, previously-hidden
-- failure on the SAME create-retailer flow: ensure_default_retailer_visual_preset()
-- (added in 20260806130000_seed_default_retailer_visual_presets.sql) is an
-- AFTER INSERT trigger on public.retailers that inserts a default row into
-- public.retailer_visual_presets. That table's only INSERT policy,
-- "retailer managers write tenant visual presets", requires
-- retailer_id = current_retailer_id() AND current_retailer_role() IN
-- ('manager','admin','owner'). For a brand-new retailer being created by a
-- platform admin, no retailer_staff_members row exists yet for that
-- retailer, so current_retailer_id()/current_retailer_role() can never
-- satisfy that check -- the platform-staff READ policy on this table has an
-- `OR is_platform_staff()` escape hatch, but the WRITE/INSERT policies do
-- not. This trigger's insert was therefore never actually reachable for
-- platform-admin-driven retailer creation; it only "worked" in the sense
-- that it never got a chance to run before the try-on-policy trigger threw
-- first and rolled back the whole transaction.
--
-- Fix: same pattern as the try-on-policy fix -- mark this trigger function
-- SECURITY DEFINER so it runs as its owner (bypassing RLS, since table
-- owners are exempt from RLS unless FORCE ROW LEVEL SECURITY is set, which
-- this table does not use) regardless of the calling session's retailer
-- scope. search_path is already pinned to '' and all references are
-- fully-qualified, so this is not exposed to search-path hijacking. The
-- values inserted are all static defaults plus new.id, sourced from the
-- row already being inserted into retailers -- not caller-controllable
-- beyond what the caller was already permitted to insert there.

create or replace function public.ensure_default_retailer_visual_preset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.retailer_visual_presets (
    retailer_id, name, is_default, background_type, pose_family,
    camera_height, camera_distance, crop, aspect_ratio, lighting,
    expression, visual_treatment, negative_constraints
  ) values (
    new.id,
    'Studio default',
    true,
    'studio_neutral',
    'three_quarter',
    'eye_level',
    'medium',
    'full_length',
    '4:5',
    'soft_studio',
    'neutral',
    'quiet, editorial, premium menswear photography',
    '["visible logos", "text overlays", "distorted proportions"]'::jsonb
  )
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.ensure_default_retailer_visual_preset() from public;
