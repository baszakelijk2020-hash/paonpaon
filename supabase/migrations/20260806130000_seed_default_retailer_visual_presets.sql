-- Virtual Wardrobe Studio — every retailer gets one sensible default
-- visual preset automatically (VWS-001 / PHASE 4.8), so "routine
-- customer/advisor generation uses the retailer's default preset
-- automatically" (founder brief) has something to resolve to. A trigger,
-- not a one-time backfill INSERT, because migrations run before
-- `supabase/seed.sql` populates `retailers` — a plain backfill would see
-- an empty table locally. The trigger fires for every retailer, seeded or
-- real, present or future, closing the "new retailers don't get one"
-- gap outright rather than leaving it open.
--
-- A retailer-side settings UI to author/edit further presets is out of
-- scope for this slice (customer-facing single-look Studio) — named
-- honestly as a fast-follow rather than built here.

create or replace function public.ensure_default_retailer_visual_preset()
returns trigger
language plpgsql
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

create trigger ensure_default_retailer_visual_preset_on_insert
  after insert on public.retailers
  for each row execute function public.ensure_default_retailer_visual_preset();

-- Backfill any retailer already present in this environment before this
-- migration runs (a live/demo database with real rows, unlike a fresh
-- local reset where `retailers` is still empty at migration time).
insert into public.retailer_visual_presets (
  retailer_id, name, is_default, background_type, pose_family,
  camera_height, camera_distance, crop, aspect_ratio, lighting,
  expression, visual_treatment, negative_constraints
)
select
  r.id, 'Studio default', true, 'studio_neutral', 'three_quarter',
  'eye_level', 'medium', 'full_length', '4:5', 'soft_studio', 'neutral',
  'quiet, editorial, premium menswear photography',
  '["visible logos", "text overlays", "distorted proportions"]'::jsonb
from public.retailers r
where not exists (
  select 1 from public.retailer_visual_presets v
  where v.retailer_id = r.id and v.is_default = true
);
