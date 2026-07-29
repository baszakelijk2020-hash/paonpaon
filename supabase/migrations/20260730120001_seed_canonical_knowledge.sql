-- Idempotent canonical knowledge fixtures for PHASE 2.1.
-- Neutral reviewed copy covers every EDU-001 education topic bucket.

insert into public.metadata_concepts (
  id,
  retailer_id,
  kind,
  slug,
  canonical_name,
  active
) values
  (
    '50000000-0000-0000-0000-000000000001',
    null,
    'mill',
    'loro-piana',
    'Loro Piana',
    true
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    null,
    'fibre',
    'wool',
    'Wool',
    true
  ),
  (
    '50000000-0000-0000-0000-000000000003',
    null,
    'weave',
    'hopsack',
    'Hopsack',
    true
  ),
  (
    '50000000-0000-0000-0000-000000000004',
    null,
    'construction',
    'half-canvas',
    'Half canvas',
    true
  ),
  (
    '50000000-0000-0000-0000-000000000005',
    null,
    'collar',
    'shiller',
    'Shiller collar',
    true
  ),
  (
    '50000000-0000-0000-0000-000000000006',
    null,
    'style',
    'business-formal',
    'Business formal',
    true
  ),
  (
    '50000000-0000-0000-0000-000000000007',
    null,
    'care',
    'dry-clean-sparingly',
    'Dry clean sparingly',
    true
  ),
  (
    '50000000-0000-0000-0000-000000000008',
    null,
    'performance',
    'breathability',
    'Breathability',
    true
  ),
  (
    '50000000-0000-0000-0000-000000000009',
    null,
    'occasion',
    'summer-wedding',
    'Summer wedding',
    true
  )
on conflict do nothing;

insert into public.knowledge_objects (
  id,
  retailer_id,
  title,
  slug,
  summary,
  body,
  display_types,
  commercial_intent,
  education_topic,
  priority,
  active
) values
  (
    '51000000-0000-0000-0000-000000000001',
    null,
    'Why mill heritage matters',
    'why-mill-heritage-matters',
    'Explains why provenance affects value, handle, and long-term fit.',
    'Premium mills invest in fibre selection and finishing that changes how cloth drapes and wears over years.',
    array['information_card']::public.knowledge_display_type[],
    'justify_premium',
    'mills',
    100,
    true
  ),
  (
    '51000000-0000-0000-0000-000000000002',
    null,
    'Understanding wool fibres',
    'understanding-wool-fibres',
    'Covers why fibre choice changes warmth, drape, and breathability.',
    'Wool scales trap air for warmth while still allowing moisture to move away from the body.',
    array['information_card']::public.knowledge_display_type[],
    'educate',
    'fibres',
    95,
    true
  ),
  (
    '51000000-0000-0000-0000-000000000003',
    null,
    'Cloth versus finished garment',
    'cloth-versus-finished-garment',
    'Separates fabric behaviour from cut, lining, and construction choices.',
    'The same cloth can feel different once canvassed, lined, and cut for a specific silhouette.',
    array['information_card']::public.knowledge_display_type[],
    'educate',
    'fabrics',
    90,
    true
  ),
  (
    '51000000-0000-0000-0000-000000000004',
    null,
    'Hopsack for warm weather',
    'hopsack-for-warm-weather',
    'Explains why open weaves breathe and recover shape in heat.',
    'Hopsack''s basket structure creates air pockets that improve airflow without sacrificing structure.',
    array['information_card', 'accordion']::public.knowledge_display_type[],
    'educate',
    'weaves',
    85,
    true
  ),
  (
    '51000000-0000-0000-0000-000000000005',
    null,
    'Half-canvas construction',
    'half-canvas-construction',
    'Shows how canvas supports lapel roll, drape, and longevity.',
    'A half-canvas jacket balances structure at the chest and lapel with lighter front panels.',
    array['information_card']::public.knowledge_display_type[],
    'justify_premium',
    'construction',
    80,
    true
  ),
  (
    '51000000-0000-0000-0000-000000000006',
    null,
    'The Shiller collar',
    'the-shiller-collar',
    'Explains why a one-piece collar changes the neckline and formality.',
    'A Shiller collar uses one continuous piece of cloth for a cleaner roll and sharper line.',
    array['information_card']::public.knowledge_display_type[],
    'educate',
    'collars',
    75,
    true
  ),
  (
    '51000000-0000-0000-0000-000000000007',
    null,
    'Styling business formal',
    'styling-business-formal',
    'Covers proportion, colour, and texture for office-ready tailoring.',
    'Business formal styling balances restrained colour with enough texture to avoid looking flat under office lighting.',
    array['information_card']::public.knowledge_display_type[],
    'educate',
    'styling',
    70,
    true
  ),
  (
    '51000000-0000-0000-0000-000000000008',
    null,
    'Care for tailored wool',
    'care-for-tailored-wool',
    'Sets expectations for brushing, resting, and sparing dry cleaning.',
    'Resting garments between wears and brushing nap restores appearance without aggressive cleaning.',
    array['information_card']::public.knowledge_display_type[],
    'educate',
    'care',
    65,
    true
  ),
  (
    '51000000-0000-0000-0000-000000000009',
    null,
    'Breathable performance cloth',
    'breathable-performance-cloth',
    'Explains how performance concepts translate to comfort in travel and heat.',
    'Performance here means predictable comfort: breathability, recovery, and crease resistance for real wear.',
    array['information_card']::public.knowledge_display_type[],
    'educate',
    'performance',
    60,
    true
  ),
  (
    '51000000-0000-0000-0000-000000000010',
    null,
    'Dressing for summer weddings',
    'dressing-for-summer-weddings',
    'Maps occasion formality to cloth weight, colour, and accessories.',
    'Summer weddings call for lighter cloth, softer structure, and breathable linings without losing ceremony.',
    array['information_card']::public.knowledge_display_type[],
    'appointment',
    'occasion',
    55,
    true
  ),
  (
    '51000000-0000-0000-0000-000000000011',
    null,
    'Understanding premium value',
    'understanding-premium-value',
    'Explains where cost accumulates across cloth, make, and service.',
    'Premium value comes from durable materials, skilled make, and aftercare that extends garment life.',
    array['information_card']::public.knowledge_display_type[],
    'justify_premium',
    'value',
    50,
    true
  ),
  (
    '51000000-0000-0000-0000-000000000012',
    null,
    'Cloth tradeoffs in practice',
    'cloth-tradeoffs-in-practice',
    'Compares warmth, breathability, wrinkle recovery, and formality tradeoffs.',
    'Every cloth trades off drape, durability, and climate suitability; the right choice depends on use case.',
    array['comparison']::public.knowledge_display_type[],
    'educate',
    'tradeoffs',
    45,
    true
  ),
  (
    '51000000-0000-0000-0000-000000000013',
    null,
    'Draft editorial review card',
    'draft-editorial-review-card',
    'Inactive fixture reserved for editorial review workflows.',
    'This inactive object exists to prove disabled knowledge stays ineligible for discovery.',
    array['information_card']::public.knowledge_display_type[],
    'educate',
    'styling',
    0,
    false
  )
on conflict do nothing;

insert into public.knowledge_object_concepts (
  id,
  knowledge_object_id,
  concept_id,
  match_strength
) values
  (
    '52000000-0000-0000-0000-000000000001',
    '51000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    1
  ),
  (
    '52000000-0000-0000-0000-000000000002',
    '51000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000002',
    1
  ),
  (
    '52000000-0000-0000-0000-000000000003',
    '51000000-0000-0000-0000-000000000003',
    '50000000-0000-0000-0000-000000000002',
    0.75
  ),
  (
    '52000000-0000-0000-0000-000000000004',
    '51000000-0000-0000-0000-000000000004',
    '50000000-0000-0000-0000-000000000003',
    1
  ),
  (
    '52000000-0000-0000-0000-000000000005',
    '51000000-0000-0000-0000-000000000005',
    '50000000-0000-0000-0000-000000000004',
    1
  ),
  (
    '52000000-0000-0000-0000-000000000006',
    '51000000-0000-0000-0000-000000000006',
    '50000000-0000-0000-0000-000000000005',
    1
  ),
  (
    '52000000-0000-0000-0000-000000000007',
    '51000000-0000-0000-0000-000000000007',
    '50000000-0000-0000-0000-000000000006',
    0.9
  ),
  (
    '52000000-0000-0000-0000-000000000008',
    '51000000-0000-0000-0000-000000000008',
    '50000000-0000-0000-0000-000000000007',
    1
  ),
  (
    '52000000-0000-0000-0000-000000000009',
    '51000000-0000-0000-0000-000000000009',
    '50000000-0000-0000-0000-000000000008',
    1
  ),
  (
    '52000000-0000-0000-0000-000000000010',
    '51000000-0000-0000-0000-000000000010',
    '50000000-0000-0000-0000-000000000009',
    1
  ),
  (
    '52000000-0000-0000-0000-000000000011',
    '51000000-0000-0000-0000-000000000011',
    '50000000-0000-0000-0000-000000000001',
    0.8
  ),
  (
    '52000000-0000-0000-0000-000000000012',
    '51000000-0000-0000-0000-000000000012',
    '50000000-0000-0000-0000-000000000003',
    0.85
  )
on conflict do nothing;

insert into public.knowledge_object_relations (
  id,
  retailer_id,
  source_knowledge_object_id,
  target_knowledge_object_id,
  kind
) values
  (
    '53000000-0000-0000-0000-000000000001',
    null,
    '51000000-0000-0000-0000-000000000001',
    '51000000-0000-0000-0000-000000000002',
    'related'
  ),
  (
    '53000000-0000-0000-0000-000000000002',
    null,
    '51000000-0000-0000-0000-000000000002',
    '51000000-0000-0000-0000-000000000004',
    'prerequisite'
  ),
  (
    '53000000-0000-0000-0000-000000000003',
    null,
    '51000000-0000-0000-0000-000000000012',
    '51000000-0000-0000-0000-000000000004',
    'comparison'
  )
on conflict do nothing;
