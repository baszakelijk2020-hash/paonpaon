-- Create missing specific knowledge concepts (Super 130s, Super 190s,
-- alpaca-wool blend, pin stripe origin) and link real products to the
-- MOST SPECIFIC fact about them (mill name, yarn fineness, fibre blend,
-- weave pattern) instead of the generic "wool" card, per founder spec:
-- read the product name/description, pick what actually drives the sale.

-- 1. New concepts + knowledge objects -----------------------------------

insert into metadata_concepts (id, slug, kind, canonical_name)
values
  ('d5000000-0000-4000-8000-000000000130', 'super-130s', 'fibre', 'Super 130s'),
  ('d5000000-0000-4000-8000-000000000190', 'super-190s', 'fibre', 'Super 190s'),
  ('d5000000-0000-4000-8000-000000000201', 'pin-stripe', 'weave', 'Pin Stripe')
on conflict (id) do nothing;

insert into knowledge_objects (id, topic, title, slug, summary, body, display_types, commercial_intent, priority, active)
values
  (
    'e6000000-0000-4000-8000-000000000130',
    'fibre',
    'Super 130s Wool',
    'super-130s-wool',
    'The benchmark fineness for everyday luxury tailoring — refined without sacrificing durability.',
    E'Super 130s sits at the point where a suiting wool stops trading durability for softness. The number counts how many 560-yard hanks can be spun from one pound of the fibre — the higher the count, the finer the individual strand, and 130s is fine enough to feel genuinely soft against the skin while still holding a crisp line through a working week.\n\nIt is the wool most tailoring houses reach for as their default recommendation, not because it is the most luxurious number available, but because it is the most versatile one. A Super 130s suit travels well, resists the shine that finer, more fragile counts develop with wear, and takes a press cleanly fitting after fitting.\n\nChoose Super 130s when the garment needs to actually work for a living — daily business wear, a suit that goes from a morning meeting to an evening dinner without visibly tiring.',
    array['information_card','accordion']::knowledge_display_type[],
    'educate',
    5,
    true
  ),
  (
    'e6000000-0000-4000-8000-000000000190',
    'fibre',
    'Super 190s Wool',
    'super-190s-wool',
    'Among the finest merino counts spun for tailoring — exceptional softness, reserved for pieces worn rather than worked in.',
    E'Super 190s is close to the practical ceiling of merino wool fineness. Reaching this count requires fleece from a small number of merino bloodlines bred specifically for micron diameter, and the yarn itself is delicate enough that milling it into cloth demands slower, more careful production than coarser counts.\n\nThe result is a fabric with a noticeably lighter hand and a soft, almost liquid drape — it moves with the body rather than holding a rigid shape. That same fineness is also its limitation: Super 190s wears more visibly than lower counts and rewards a garment that is not in daily rotation.\n\nThis is a number for occasion pieces and considered wardrobes — something reached for when the softness itself is the point, not just a suit for the office.',
    array['information_card','accordion']::knowledge_display_type[],
    'justify_premium',
    8,
    true
  ),
  (
    'e6000000-0000-4000-8000-000000000201',
    'weave',
    'The Pin Stripe',
    'pin-stripe',
    'A pattern born in 19th-century British banking, not decoration — the stripe was originally a house code.',
    E'The pin stripe did not start as a fashion choice. In 19th-century Britain, some sources trace its earliest use to clerks and bank employees, where a fine, evenly spaced stripe (sometimes tied to specific banking houses as an identifying mark) distinguished formal business dress from the broader chalk stripe worn more casually. By the early 20th century it had crossed the Atlantic and become the default cloth of Wall Street and the American boardroom.\n\nTechnically, a pin stripe is formed by a single fine thread (or a tight pair) woven at regular intervals against a solid ground colour — thinner and more closely spaced than a chalk stripe, which is drawn with a chalky, diffused yarn instead. That precision is what reads as "sharp" rather than "soft" from across a room.\n\nA pin stripe suit still carries that original association: considered, formal, built for a room where authority is communicated through restraint rather than pattern.',
    array['information_card','accordion']::knowledge_display_type[],
    'educate',
    5,
    true
  )
on conflict (id) do nothing;

insert into knowledge_object_concepts (knowledge_object_id, concept_id)
select v.koid, v.cid
from (values
  ('e6000000-0000-4000-8000-000000000130'::uuid, 'd5000000-0000-4000-8000-000000000130'::uuid),
  ('e6000000-0000-4000-8000-000000000190'::uuid, 'd5000000-0000-4000-8000-000000000190'::uuid),
  ('e6000000-0000-4000-8000-000000000201'::uuid, 'd5000000-0000-4000-8000-000000000201'::uuid)
) as v(koid, cid)
where not exists (
  select 1 from knowledge_object_concepts existing
  where existing.knowledge_object_id = v.koid
    and existing.concept_id = v.cid
    and existing.deleted_at is null
);

-- 2. Precise per-product assignment ---------------------------------------

with staff as (
  select id as staff_id, retailer_id from retailer_staff_members
),
super_matches as (
  select p.id as product_id, p.retailer_id,
    case m.n
      when '130' then 'd5000000-0000-4000-8000-000000000130'::uuid
      when '190' then 'd5000000-0000-4000-8000-000000000190'::uuid
    end as concept_id
  from products p,
    lateral (select (regexp_matches(p.name, 'S(\d{3})'))[1] as n) m
  where p.name ~ 'S(130|190)\M'
),
alpaca_matches as (
  select p.id as product_id, p.retailer_id,
    'd5000000-0000-4000-8000-000000000025'::uuid as concept_id
  from products p
  where p.name ilike '%alpaca%'
),
pinstripe_matches as (
  select p.id as product_id, p.retailer_id,
    'd5000000-0000-4000-8000-000000000201'::uuid as concept_id
  from products p
  where p.name ilike '%pin strip%' or p.name ilike '%pinstripe%'
),
mill_name_map (needle, concept_id) as (
  values
    ('Loro Piana', 'd5000000-0000-4000-8000-000000000001'::uuid),
    ('Zegna', 'd5000000-0000-4000-8000-000000000002'::uuid),
    ('Drago', 'd5000000-0000-4000-8000-000000000004'::uuid),
    ('Carlo Barbera', 'd5000000-0000-4000-8000-000000000005'::uuid),
    ('Scabal', 'd5000000-0000-4000-8000-000000000009'::uuid),
    ('Reda', 'd5000000-0000-4000-8000-000000000011'::uuid),
    ('Guabello', 'd5000000-0000-4000-8000-000000000013'::uuid),
    ('Marzotto', 'd5000000-0000-4000-8000-000000000014'::uuid),
    ('Albini', 'd5000000-0000-4000-8000-000000000016'::uuid)
),
mill_matches as (
  select p.id as product_id, p.retailer_id, m.concept_id
  from products p
  join mill_name_map m on p.description ilike '%from ' || m.needle || '.%'
),
specific_matches as (
  select distinct product_id, retailer_id, concept_id from super_matches where concept_id is not null
  union
  select distinct product_id, retailer_id, concept_id from alpaca_matches
  union
  select distinct product_id, retailer_id, concept_id from pinstripe_matches
  union
  select distinct product_id, retailer_id, concept_id from mill_matches
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

-- 3. Demote the generic "wool" assignment for products that now have a
-- more specific fact, so the specific card wins the ranking instead of
-- competing with (or losing to) the generic one.

with specific_products as (
  select distinct target_id, retailer_id
  from entity_metadata_assignments
  where concept_id in (
    'd5000000-0000-4000-8000-000000000130', 'd5000000-0000-4000-8000-000000000190',
    'd5000000-0000-4000-8000-000000000025', 'd5000000-0000-4000-8000-000000000201',
    'd5000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000002',
    'd5000000-0000-4000-8000-000000000004', 'd5000000-0000-4000-8000-000000000005',
    'd5000000-0000-4000-8000-000000000009', 'd5000000-0000-4000-8000-000000000011',
    'd5000000-0000-4000-8000-000000000013', 'd5000000-0000-4000-8000-000000000014',
    'd5000000-0000-4000-8000-000000000016'
  )
),
generic_wool_concept as (
  select id from metadata_concepts where slug = 'wool' and kind = 'fibre'
)
update entity_metadata_assignments e
set deleted_at = now()
from specific_products sp, generic_wool_concept gw
where e.target_id = sp.target_id
  and e.retailer_id = sp.retailer_id
  and e.concept_id = gw.id
  and e.deleted_at is null;

select count(*) as total_assignments from entity_metadata_assignments where deleted_at is null;
