-- Distinguishes a throwaway single-slot Outfit built only to carry a
-- Complete the Look suggestion (PHASE 17.10 / 17.13) into the existing
-- Virtual Wardrobe Studio enqueue pipeline from a customer's real composed
-- "saved look" — without this flag, every "See it on me" tap permanently
-- clutters the customer's saved-looks list with a disposable single-item
-- outfit that was never meant to be browsed, cancelled or regenerated
-- alongside real looks. Additive, defaulted, no backfill risk: every
-- existing outfit is a real saved/roadmap look.

alter table public.outfits
  add column if not exists is_suggestion_generation boolean not null default false;

comment on column public.outfits.is_suggestion_generation is
  'True only for a throwaway single-slot outfit created solely to enqueue a Complete the Look suggestion''s try-on generation (PHASE 17.10/17.13) — excluded from the customer''s saved-looks listing and bulk actions.';
