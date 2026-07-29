-- Idempotent canonical knowledge fixtures for EDU-001 topics.
-- Neutral copy only; unapproved editorial placeholders stay inactive.
-- Re-running updates the same stable UUIDs without duplicating rows.

insert into public.metadata_concepts (
  id,
  retailer_id,
  kind,
  slug,
  canonical_name,
  attributes,
  active
)
values
  (
    'a1000000-0000-4000-8000-100000000001',
    null,
    'mill',
    'knowledge-fixture-mill',
    'Knowledge fixture mill',
    '{}'::jsonb,
    true
  ),
  (
    'a1000000-0000-4000-8000-100000000002',
    null,
    'fibre',
    'knowledge-fixture-fibre',
    'Knowledge fixture fibre',
    '{}'::jsonb,
    true
  ),
  (
    'a1000000-0000-4000-8000-100000000003',
    null,
    'fabric_collection',
    'knowledge-fixture-fabric',
    'Knowledge fixture fabric',
    '{}'::jsonb,
    true
  ),
  (
    'a1000000-0000-4000-8000-100000000004',
    null,
    'weave',
    'knowledge-fixture-weave',
    'Knowledge fixture weave',
    '{}'::jsonb,
    true
  ),
  (
    'a1000000-0000-4000-8000-100000000005',
    null,
    'construction',
    'knowledge-fixture-construction',
    'Knowledge fixture construction',
    '{}'::jsonb,
    true
  ),
  (
    'a1000000-0000-4000-8000-100000000006',
    null,
    'collar',
    'knowledge-fixture-collar',
    'Knowledge fixture collar',
    '{}'::jsonb,
    true
  ),
  (
    'a1000000-0000-4000-8000-100000000007',
    null,
    'style',
    'knowledge-fixture-styling',
    'Knowledge fixture styling',
    '{}'::jsonb,
    true
  ),
  (
    'a1000000-0000-4000-8000-100000000008',
    null,
    'care',
    'knowledge-fixture-care',
    'Knowledge fixture care',
    '{}'::jsonb,
    true
  ),
  (
    'a1000000-0000-4000-8000-100000000009',
    null,
    'performance',
    'knowledge-fixture-performance',
    'Knowledge fixture performance',
    '{}'::jsonb,
    true
  ),
  (
    'a1000000-0000-4000-8000-100000000010',
    null,
    'occasion',
    'knowledge-fixture-occasion',
    'Knowledge fixture occasion',
    '{}'::jsonb,
    true
  ),
  (
    'a1000000-0000-4000-8000-100000000011',
    null,
    'compatibility',
    'knowledge-fixture-value',
    'Knowledge fixture value',
    '{}'::jsonb,
    true
  ),
  (
    'a1000000-0000-4000-8000-100000000012',
    null,
    'compatibility',
    'knowledge-fixture-tradeoff',
    'Knowledge fixture tradeoff',
    '{}'::jsonb,
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

insert into public.knowledge_objects (
  id,
  retailer_id,
  topic,
  title,
  slug,
  summary,
  body,
  display_types,
  commercial_intent,
  priority,
  active
)
values
  (
    'a1000000-0000-4000-8000-000000000001',
    null,
    'mill',
    'What a mill signals',
    'what-a-mill-signals',
    'A mill name is a provenance cue: cloth origin, finishing standards, and expected hand.',
    'Neutral fixture: mills explain why cloth provenance affects feel, longevity, and price without naming unapproved house copy.',
    array['information_card']::public.knowledge_display_type[],
    'educate',
    100,
    true
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    null,
    'fibre',
    'Why fibre composition matters',
    'why-fibre-composition-matters',
    'Fibre choice shapes breathability, drape, crease behaviour, and care demands.',
    'Neutral fixture: fibres explain who a cloth suits and what tradeoffs follow from wool, linen, silk, cotton, or blends.',
    array['information_card', 'tooltip']::public.knowledge_display_type[],
    'educate',
    90,
    true
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    null,
    'fabric',
    'Reading a fabric profile',
    'reading-a-fabric-profile',
    'Weight, hand, and seasonality turn composition into a practical buying brief.',
    'Neutral fixture: fabric profiles connect composition and weight to climate and use without inventing product facts.',
    array['information_card', 'accordion']::public.knowledge_display_type[],
    'justify_premium',
    80,
    true
  ),
  (
    'a1000000-0000-4000-8000-000000000004',
    null,
    'weave',
    'Weave and pattern cues',
    'weave-and-pattern-cues',
    'Weave structure changes resilience, openness, and visual formality.',
    'Neutral fixture: weaves such as tropical, hopsack, or herringbone explain performance and styling effects.',
    array['information_card']::public.knowledge_display_type[],
    'educate',
    70,
    true
  ),
  (
    'a1000000-0000-4000-8000-000000000005',
    null,
    'construction',
    'Construction and comfort',
    'construction-and-comfort',
    'Canvas, lining, and soft construction decide shape retention versus ease.',
    'Neutral fixture: construction topics explain fit feel and longevity tradeoffs for tailored garments.',
    array['information_card', 'comparison']::public.knowledge_display_type[],
    'upgrade',
    60,
    true
  ),
  (
    'a1000000-0000-4000-8000-000000000006',
    null,
    'collar',
    'Collar detail and shirt options',
    'collar-detail-and-shirt-options',
    'Collar geometry changes face framing, formality, and accessory pairing.',
    'Neutral fixture: collar education covers options such as one-piece constructions without unverified brand claims.',
    array['information_card', 'tooltip']::public.knowledge_display_type[],
    'cross_sell',
    50,
    true
  ),
  (
    'a1000000-0000-4000-8000-000000000007',
    null,
    'styling',
    'Styling compatibility basics',
    'styling-compatibility-basics',
    'Compatible pairings keep formality, colour, and fabric weight coherent.',
    'Neutral fixture: styling cards outline complete-look guidance grounded in approved concepts.',
    array['information_card', 'advisor_answer']::public.knowledge_display_type[],
    'cross_sell',
    40,
    true
  ),
  (
    'a1000000-0000-4000-8000-000000000008',
    null,
    'care',
    'Care expectations',
    'care-expectations',
    'Care guidance protects cloth investment and sets honest ownership effort.',
    'Neutral fixture: care topics explain cleaning, pressing, and storage demands tied to fibre and finish.',
    array['accordion', 'tooltip']::public.knowledge_display_type[],
    'educate',
    30,
    true
  ),
  (
    'a1000000-0000-4000-8000-000000000009',
    null,
    'performance',
    'Performance in real conditions',
    'performance-in-real-conditions',
    'Breathability, crease resistance, and travel behaviour follow weave and fibre.',
    'Neutral fixture: performance cards connect climate and use cases without inventing lab claims.',
    array['information_card', 'comparison']::public.knowledge_display_type[],
    'justify_premium',
    20,
    true
  ),
  (
    'a1000000-0000-4000-8000-000000000010',
    null,
    'occasion',
    'Occasion and formality fit',
    'occasion-and-formality-fit',
    'Occasion cues translate dress codes into cloth, colour, and construction choices.',
    'Neutral fixture: occasion education supports wedding, travel, and business contexts from approved metadata.',
    array['information_card', 'advisor_answer']::public.knowledge_display_type[],
    'appointment',
    10,
    true
  ),
  (
    'a1000000-0000-4000-8000-000000000011',
    null,
    'value',
    'Where value accumulates',
    'where-value-accumulates',
    'Value follows cloth quality, construction longevity, and reuse across occasions.',
    'Neutral fixture: value cards justify premium choices through durability and versatility, not discount framing.',
    array['information_card']::public.knowledge_display_type[],
    'justify_premium',
    5,
    true
  ),
  (
    'a1000000-0000-4000-8000-000000000012',
    null,
    'tradeoff',
    'Honest tradeoffs',
    'honest-tradeoffs',
    'Every cloth and construction choice trades comfort, formality, or care effort.',
    'Neutral fixture: tradeoff cards keep recommendations explainable when two good options conflict.',
    array['comparison', 'advisor_answer']::public.knowledge_display_type[],
    'educate',
    0,
    true
  ),
  (
    'a1000000-0000-4000-8000-000000000013',
    null,
    'mill',
    'Unapproved mill editorial placeholder',
    'unapproved-mill-editorial-placeholder',
    'Placeholder reserved for founder-approved mill storytelling and imagery.',
    'Inactive until reviewed production copy and images are approved.',
    array['information_card']::public.knowledge_display_type[],
    'educate',
    -10,
    false
  )
on conflict (id) do update
set
  topic = excluded.topic,
  title = excluded.title,
  slug = excluded.slug,
  summary = excluded.summary,
  body = excluded.body,
  display_types = excluded.display_types,
  commercial_intent = excluded.commercial_intent,
  priority = excluded.priority,
  active = excluded.active,
  deleted_at = null,
  updated_at = now();

insert into public.knowledge_object_concepts (
  id,
  knowledge_object_id,
  concept_id,
  match_strength
)
values
  (
    'a1000000-0000-4000-8000-200000000001',
    'a1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-100000000001',
    1
  ),
  (
    'a1000000-0000-4000-8000-200000000002',
    'a1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-100000000002',
    1
  ),
  (
    'a1000000-0000-4000-8000-200000000003',
    'a1000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-100000000003',
    0.9
  ),
  (
    'a1000000-0000-4000-8000-200000000004',
    'a1000000-0000-4000-8000-000000000004',
    'a1000000-0000-4000-8000-100000000004',
    1
  ),
  (
    'a1000000-0000-4000-8000-200000000005',
    'a1000000-0000-4000-8000-000000000005',
    'a1000000-0000-4000-8000-100000000005',
    1
  ),
  (
    'a1000000-0000-4000-8000-200000000006',
    'a1000000-0000-4000-8000-000000000006',
    'a1000000-0000-4000-8000-100000000006',
    1
  ),
  (
    'a1000000-0000-4000-8000-200000000007',
    'a1000000-0000-4000-8000-000000000007',
    'a1000000-0000-4000-8000-100000000007',
    0.85
  ),
  (
    'a1000000-0000-4000-8000-200000000008',
    'a1000000-0000-4000-8000-000000000008',
    'a1000000-0000-4000-8000-100000000008',
    1
  ),
  (
    'a1000000-0000-4000-8000-200000000009',
    'a1000000-0000-4000-8000-000000000009',
    'a1000000-0000-4000-8000-100000000009',
    1
  ),
  (
    'a1000000-0000-4000-8000-200000000010',
    'a1000000-0000-4000-8000-000000000010',
    'a1000000-0000-4000-8000-100000000010',
    1
  ),
  (
    'a1000000-0000-4000-8000-200000000011',
    'a1000000-0000-4000-8000-000000000011',
    'a1000000-0000-4000-8000-100000000011',
    0.75
  ),
  (
    'a1000000-0000-4000-8000-200000000012',
    'a1000000-0000-4000-8000-000000000012',
    'a1000000-0000-4000-8000-100000000012',
    0.8
  ),
  (
    'a1000000-0000-4000-8000-200000000013',
    'a1000000-0000-4000-8000-000000000013',
    'a1000000-0000-4000-8000-100000000001',
    0.5
  )
on conflict (id) do update
set
  knowledge_object_id = excluded.knowledge_object_id,
  concept_id = excluded.concept_id,
  match_strength = excluded.match_strength,
  deleted_at = null,
  updated_at = now();

insert into public.knowledge_object_relations (
  id,
  source_knowledge_object_id,
  target_knowledge_object_id
)
values
  (
    'a1000000-0000-4000-8000-300000000001',
    'a1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000003'
  ),
  (
    'a1000000-0000-4000-8000-300000000002',
    'a1000000-0000-4000-8000-000000000004',
    'a1000000-0000-4000-8000-000000000009'
  )
on conflict (id) do update
set
  source_knowledge_object_id = excluded.source_knowledge_object_id,
  target_knowledge_object_id = excluded.target_knowledge_object_id,
  deleted_at = null,
  updated_at = now();
