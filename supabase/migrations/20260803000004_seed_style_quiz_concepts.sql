-- Canonical (retailer_id null) concepts backing the low-friction wardrobe
-- questionnaire: 12 "style"-kind archetype cards a customer taps once, plus
-- a personal-tweak layer spread across the existing fit/pattern/colour/
-- formality kinds. No new tables or enum values — a tap declares a real
-- style preference through the existing `upsert_declared_style_preference`
-- RPC, same as any other declared concept. Idempotent, stable UUIDs.

insert into public.metadata_concepts (
  id, retailer_id, kind, slug, canonical_name, attributes, active
)
values
  (
    'b2000000-0000-4000-8000-200000000001', null, 'style',
    'archetype-classic-tailored', 'Classic Tailored',
    '{"isArchetype": true, "order": 1, "emoji": "🎩", "description": "Timeless business suiting, minimal pattern, built to last decades."}'::jsonb,
    true
  ),
  (
    'b2000000-0000-4000-8000-200000000002', null, 'style',
    'archetype-modern-executive', 'Modern Executive',
    '{"isArchetype": true, "order": 2, "emoji": "🧥", "description": "Contemporary cut, sharper shoulder, still boardroom-ready."}'::jsonb,
    true
  ),
  (
    'b2000000-0000-4000-8000-200000000003', null, 'style',
    'archetype-smart-casual', 'Smart Casual',
    '{"isArchetype": true, "order": 3, "emoji": "👔", "description": "Odd jacket and trouser, no tie — sharp without formal armour."}'::jsonb,
    true
  ),
  (
    'b2000000-0000-4000-8000-200000000004', null, 'style',
    'archetype-weekend-relaxed', 'Weekend Relaxed',
    '{"isArchetype": true, "order": 4, "emoji": "🧶", "description": "Knitwear, chinos, unstructured — off-duty comfort."}'::jsonb,
    true
  ),
  (
    'b2000000-0000-4000-8000-200000000005', null, 'style',
    'archetype-creative-professional', 'Creative Professional',
    '{"isArchetype": true, "order": 5, "emoji": "🎨", "description": "Softer tailoring with texture and colour for studios, not boardrooms."}'::jsonb,
    true
  ),
  (
    'b2000000-0000-4000-8000-200000000006', null, 'style',
    'archetype-black-tie', 'Black Tie & Formal',
    '{"isArchetype": true, "order": 6, "emoji": "🥂", "description": "Evening formalwear for the occasions that call for it."}'::jsonb,
    true
  ),
  (
    'b2000000-0000-4000-8000-200000000007', null, 'style',
    'archetype-wedding-party', 'Wedding & Celebration',
    '{"isArchetype": true, "order": 7, "emoji": "💍", "description": "Groom, groomsman, guest — coordinated for the big day."}'::jsonb,
    true
  ),
  (
    'b2000000-0000-4000-8000-200000000008', null, 'style',
    'archetype-preppy-ivy', 'Preppy Ivy',
    '{"isArchetype": true, "order": 8, "emoji": "⛵", "description": "Heritage blazers, repp ties, unfussy East Coast polish."}'::jsonb,
    true
  ),
  (
    'b2000000-0000-4000-8000-200000000009', null, 'style',
    'archetype-minimalist-monochrome', 'Minimalist Monochrome',
    '{"isArchetype": true, "order": 9, "emoji": "⚪", "description": "Clean lines, neutral palette, nothing shouting for attention."}'::jsonb,
    true
  ),
  (
    'b2000000-0000-4000-8000-200000000010', null, 'style',
    'archetype-bold-pattern', 'Bold Pattern & Colour',
    '{"isArchetype": true, "order": 10, "emoji": "🌈", "description": "Statement checks, colour blocking, pattern mixed with intent."}'::jsonb,
    true
  ),
  (
    'b2000000-0000-4000-8000-200000000011', null, 'style',
    'archetype-rugged-heritage', 'Rugged Heritage',
    '{"isArchetype": true, "order": 11, "emoji": "🥾", "description": "Tweed, waxed cotton, workwear details built for the outdoors."}'::jsonb,
    true
  ),
  (
    'b2000000-0000-4000-8000-200000000012', null, 'style',
    'archetype-resort-travel', 'Resort & Travel',
    '{"isArchetype": true, "order": 12, "emoji": "☀️", "description": "Lightweight, unstructured tailoring for warm climates and packing light."}'::jsonb,
    true
  ),

  -- Personal-tweak layer: one question per group, single tap per option.
  (
    'b3000000-0000-4000-8000-300000000001', null, 'fit',
    'fit-slim', 'Slim',
    '{"tweakGroup": "fit", "question": "How do you like your fit?", "groupOrder": 1, "order": 1}'::jsonb,
    true
  ),
  (
    'b3000000-0000-4000-8000-300000000002', null, 'fit',
    'fit-regular', 'Regular',
    '{"tweakGroup": "fit", "question": "How do you like your fit?", "groupOrder": 1, "order": 2}'::jsonb,
    true
  ),
  (
    'b3000000-0000-4000-8000-300000000003', null, 'fit',
    'fit-relaxed', 'Relaxed',
    '{"tweakGroup": "fit", "question": "How do you like your fit?", "groupOrder": 1, "order": 3}'::jsonb,
    true
  ),
  (
    'b3000000-0000-4000-8000-300000000004', null, 'pattern',
    'pattern-solids-only', 'Solids only',
    '{"tweakGroup": "pattern", "question": "How bold should patterns be?", "groupOrder": 2, "order": 1}'::jsonb,
    true
  ),
  (
    'b3000000-0000-4000-8000-300000000005', null, 'pattern',
    'pattern-subtle-texture', 'Subtle texture',
    '{"tweakGroup": "pattern", "question": "How bold should patterns be?", "groupOrder": 2, "order": 2}'::jsonb,
    true
  ),
  (
    'b3000000-0000-4000-8000-300000000006', null, 'pattern',
    'pattern-bold-mixing', 'Bold and mixed',
    '{"tweakGroup": "pattern", "question": "How bold should patterns be?", "groupOrder": 2, "order": 3}'::jsonb,
    true
  ),
  (
    'b3000000-0000-4000-8000-300000000007', null, 'colour',
    'colour-neutral-tones', 'Neutral tones',
    '{"tweakGroup": "colour", "question": "What''s your colour comfort zone?", "groupOrder": 3, "order": 1}'::jsonb,
    true
  ),
  (
    'b3000000-0000-4000-8000-300000000008', null, 'colour',
    'colour-rich-colour', 'Rich colour',
    '{"tweakGroup": "colour", "question": "What''s your colour comfort zone?", "groupOrder": 3, "order": 2}'::jsonb,
    true
  ),
  (
    'b3000000-0000-4000-8000-300000000009', null, 'colour',
    'colour-high-contrast', 'High contrast',
    '{"tweakGroup": "colour", "question": "What''s your colour comfort zone?", "groupOrder": 3, "order": 3}'::jsonb,
    true
  ),
  (
    'b3000000-0000-4000-8000-300000000010', null, 'formality',
    'formality-lean-formal', 'More formal',
    '{"tweakGroup": "formality", "question": "Where do you lean day to day?", "groupOrder": 4, "order": 1}'::jsonb,
    true
  ),
  (
    'b3000000-0000-4000-8000-300000000011', null, 'formality',
    'formality-lean-casual', 'More casual',
    '{"tweakGroup": "formality", "question": "Where do you lean day to day?", "groupOrder": 4, "order": 2}'::jsonb,
    true
  )
on conflict (id) do update
set
  kind = excluded.kind,
  slug = excluded.slug,
  canonical_name = excluded.canonical_name,
  attributes = excluded.attributes,
  active = excluded.active,
  deleted_at = null,
  updated_at = now();
