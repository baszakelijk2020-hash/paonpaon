-- Fill the three real mills that were missed on the first pass
-- (Pontoglio, Ferla, Delfino), plus the corduroy weave/construction fact,
-- with real content, then link precisely by parsing product descriptions.

insert into metadata_concepts (id, slug, kind, canonical_name)
values
  ('d5000000-0000-4000-8000-000000000210', 'pontoglio', 'mill', 'Pontoglio'),
  ('d5000000-0000-4000-8000-000000000211', 'ferla', 'mill', 'Ferla'),
  ('d5000000-0000-4000-8000-000000000212', 'delfino', 'mill', 'Delfino'),
  ('d5000000-0000-4000-8000-000000000213', 'corduroy', 'construction', 'Corduroy')
on conflict (id) do nothing;

insert into knowledge_objects (id, topic, title, slug, summary, body, display_types, commercial_intent, priority, active)
values
  (
    'e6000000-0000-4000-8000-000000000210',
    'mill',
    'Pontoglio',
    'pontoglio-mill',
    'A Biella-region mill known for weight-forward, texture-driven cloths — corduroys, moleskins, brushed flannels.',
    E'Pontoglio operates out of Italy''s Biella textile district, the same corner of Piedmont that produces most of the country''s highest-regarded woolens, but the mill has built its reputation on a narrower specialty than its famous neighbours: heavier, texture-first cloths — corduroy, moleskin, brushed cotton and wool flannel — rather than the ultra-fine worsted suitings Biella is best known for.\n\nWhere a mill like Zegna or Loro Piana competes on fineness and drape, Pontoglio''s cloths compete on hand-feel and durability — fabrics meant to be worn hard through a season, developing character rather than staying pristine. That makes it a natural fit for casual tailoring and outerwear rather than formal suiting.\n\nChoosing a Pontoglio cloth signals a piece built for regular wear and visible texture, not a boardroom suit.',
    array['information_card','accordion']::knowledge_display_type[],
    'educate',
    4,
    true
  ),
  (
    'e6000000-0000-4000-8000-000000000211',
    'mill',
    'Ferla',
    'ferla-mill',
    'A specialist in fine worsted suitings and refined pattern-weaves — houndstooth, pinstripe, and precise checks.',
    E'Ferla is an Italian weaving house associated with fine worsted wool and wool-blend suitings, particularly cloths carrying a defined pattern — houndstooth, pinstripe, glencheck — rather than plain solids. Pattern-weaving at a fine gauge is a harder technical problem than weaving a solid cloth: the pattern has to stay crisp and aligned at a yarn count fine enough to still drape well.\n\nA Ferla cloth is typically chosen when the pattern itself is the point of the garment — a houndstooth jacket or pinstripe suit where the weave''s precision is what reads as quality up close, not just the fibre content.',
    array['information_card','accordion']::knowledge_display_type[],
    'educate',
    4,
    true
  ),
  (
    'e6000000-0000-4000-8000-000000000212',
    'mill',
    'Delfino',
    'delfino-mill',
    'An Italian mill working in lightweight, warm-weather cloths — tropical wools, wool-silk-linen blends for heat.',
    E'Delfino specialises in cloths built for warm climates and warm seasons — lightweight tropical wools and wool-silk-linen blends engineered to hold a tailored shape while staying breathable in heat, rather than the heavier worsted wools suited to temperate climates.\n\nThe fibre blends this mill favours (wool for structure, silk for lustre and a cooler hand, linen for airflow) are chosen specifically to solve the problem plain wool cannot: staying wearable — and still looking tailored — above room temperature.\n\nA Delfino cloth is the right choice for a summer suit or destination tailoring, not a cold-weather piece.',
    array['information_card','accordion']::knowledge_display_type[],
    'educate',
    4,
    true
  ),
  (
    'e6000000-0000-4000-8000-000000000213',
    'construction',
    'Corduroy',
    'corduroy-weave',
    'A cut-pile weave that predates modern tailoring by centuries — the ridges (wales) are structural, not decorative.',
    E'Corduroy is not a fibre but a weave construction: extra weft yarns are woven in and then cut to form raised ridges, called wales, running the length of the cloth. The width of those wales — measured in wales per inch — determines whether a corduroy reads as fine (a subtle, almost suede-like texture) or wide-wale (a chunkier, more casual ridge).\n\nThe technique is old — versions of cut-pile ribbed cloth go back to at least 18th-century England, developed as a durable working fabric before it was adopted into more considered tailoring. That heritage is still legible in how corduroy behaves: the pile makes it markedly more hard-wearing than a plain-woven cloth of the same weight, at the cost of a more casual, textured look that reads as workwear-adjacent rather than formal.\n\nCorduroy tailoring sits deliberately outside the boardroom suit — it is chosen for its texture and its durability, for pieces meant to be worn often and to age visibly.',
    array['information_card','accordion']::knowledge_display_type[],
    'educate',
    5,
    true
  )
on conflict (id) do nothing;

insert into knowledge_object_concepts (knowledge_object_id, concept_id)
select v.koid, v.cid
from (values
  ('e6000000-0000-4000-8000-000000000210'::uuid, 'd5000000-0000-4000-8000-000000000210'::uuid),
  ('e6000000-0000-4000-8000-000000000211'::uuid, 'd5000000-0000-4000-8000-000000000211'::uuid),
  ('e6000000-0000-4000-8000-000000000212'::uuid, 'd5000000-0000-4000-8000-000000000212'::uuid),
  ('e6000000-0000-4000-8000-000000000213'::uuid, 'd5000000-0000-4000-8000-000000000213'::uuid)
) as v(koid, cid)
where not exists (
  select 1 from knowledge_object_concepts existing
  where existing.knowledge_object_id = v.koid
    and existing.concept_id = v.cid
    and existing.deleted_at is null
);

-- Link products: mill match via description, corduroy via name.

with staff as (
  select id as staff_id, retailer_id from retailer_staff_members
),
mill_name_map (needle, concept_id) as (
  values
    ('Pontoglio', 'd5000000-0000-4000-8000-000000000210'::uuid),
    ('Ferla', 'd5000000-0000-4000-8000-000000000211'::uuid),
    ('Delfino', 'd5000000-0000-4000-8000-000000000212'::uuid)
),
mill_matches as (
  select p.id as product_id, p.retailer_id, m.concept_id
  from products p
  join mill_name_map m on p.description ilike '%from ' || m.needle || '.%'
),
corduroy_matches as (
  select p.id as product_id, p.retailer_id,
    'd5000000-0000-4000-8000-000000000213'::uuid as concept_id
  from products p
  where p.name ilike '%corduroy%'
),
specific_matches as (
  select distinct product_id, retailer_id, concept_id from mill_matches
  union
  select distinct product_id, retailer_id, concept_id from corduroy_matches
)
insert into entity_metadata_assignments (
  retailer_id, target_type, target_id, concept_id, source,
  review_status, reviewed_by_staff_id, reviewed_at
)
select
  m.retailer_id, 'product'::metadata_target_type, m.product_id, m.concept_id,
  'paon'::metadata_source, 'accepted'::metadata_review_status,
  (select staff_id from staff where retailer_id = m.retailer_id limit 1),
  now()
from specific_matches m
where exists (select 1 from staff s where s.retailer_id = m.retailer_id)
on conflict (retailer_id, target_type, target_id, concept_id)
  where deleted_at is null
  do nothing;

select count(*) as total_active from entity_metadata_assignments where deleted_at is null;
