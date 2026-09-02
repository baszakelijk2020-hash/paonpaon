-- Fibre deep-dive knowledge cards. The 'fibre' topic had only 1
-- knowledge object despite 16 real fibre metadata_concepts already
-- seeded (wool, cashmere, silk, vicuna, blends) -- founder's original
-- request explicitly called for exhaustive pure-fibre and blend
-- coverage. One card per fibre concept, linked via
-- knowledge_object_concepts with match_strength 1 (exact match).
--
-- The concept-link insert below joins knowledge_objects BY SLUG,
-- not by the id literals used in the first insert: one title here
-- ('Cotton Linen Blend') collides with an existing canonical
-- knowledge_objects.slug from an earlier seed migration, so that
-- ON CONFLICT (slug) branch updates the pre-existing row in place
-- rather than creating a new one under this migration's id --
-- joining by slug means the concept link still resolves correctly
-- regardless of which row ultimately owns that slug.

INSERT INTO public.knowledge_objects (id, retailer_id, topic, title, slug, summary, body, image_url, display_types, commercial_intent, priority, active, created_at, updated_at, deleted_at)
VALUES
  ('da000000-0000-4000-8000-000000000001'::uuid, NULL, 'fibre'::public.knowledge_topic, E'Alpaca Wool'::text, 'alpaca-wool'::text, E'Luxuriously soft and thermoregulating, alpaca wool offers unmatched warmth without weight.'::text, E'Alpaca wool comes from the fleece of alpacas, primarily raised in the high Andes of Peru, Bolivia, and Ecuador. The animals are sheared annually, yielding a sustainable fibre that is both hypoallergenic and free of lanolin, making it ideal for sensitive skin.

Renowned for its exceptional softness and lightweight feel, alpaca wool provides superior insulation. Its hollow core fibres trap heat efficiently while remaining breathable, outperforming sheep’s wool in thermal regulation. The material is naturally water-resistant and durable, with a silky drape that resists pilling.

Compared to cashmere, alpaca wool is often more affordable yet equally luxurious, with better moisture-wicking properties. It blends seamlessly with merino wool for added elasticity or silk for enhanced sheen. Designers favor alpaca for its rich, natural color palette and minimal processing needs.

Choose alpaca wool for cold-weather garments that demand elegance and function. It’s perfect for sweaters, scarves, and tailored coats where warmth without bulk is paramount.'::text, NULL::text, ARRAY['information_card','accordion']::public.knowledge_display_type[], 'justify_premium'::public.knowledge_commercial_intent, 0::integer, true::boolean, now(), now(), NULL),
  ('da000000-0000-4000-8000-000000000002'::uuid, NULL, 'fibre'::public.knowledge_topic, E'Camel Hair'::text, 'camel-hair'::text, E'Luxuriously soft and insulating, camel hair is a rare natural fibre prized for its warmth and lightweight elegance.'::text, E'Camel hair is collected from the soft undercoat of the Bactrian camel, primarily found in Mongolia and China. The fibres are gathered during the molting season, then cleaned and sorted by hand to preserve their natural qualities. This labor-intensive process contributes to its exclusivity.

Camel hair is renowned for its exceptional warmth-to-weight ratio, providing insulation without bulk. The fibres are naturally hollow, trapping heat while remaining breathable. Its soft handle and smooth drape make it a favorite for tailored overcoats and luxury knitwear, offering both comfort and refinement.

Compared to wool, camel hair is softer and less prone to pilling, though it lacks the same elasticity. It blends beautifully with cashmere or fine wool to enhance durability and add a subtle sheen. Its natural golden-brown hue is distinctive, though it can also be dyed for versatility.

Choose camel hair for cold-weather pieces where lightweight warmth and understated luxury are priorities. It’s ideal for investment outerwear or elevated casual knits, offering timeless appeal and enduring performance.'::text, NULL::text, ARRAY['information_card','accordion']::public.knowledge_display_type[], 'justify_premium'::public.knowledge_commercial_intent, 0::integer, true::boolean, now(), now(), NULL),
  ('da000000-0000-4000-8000-000000000003'::uuid, NULL, 'fibre'::public.knowledge_topic, E'Cashmere'::text, 'cashmere'::text, E'The ultraluxe fibre prized for its cloud-like softness and peerless warmth-to-weight ratio.'::text, E'Cashmere comes from the undercoat of Himalayan cashmere goats, primarily raised in Mongolia, China, and Iran. The fibres are painstakingly combed by hand during spring molting, yielding just 150-200g of usable fibre per goat annually. This scarcity, combined with the labor-intensive harvesting, justifies its premium status.

Cashmere''s hollow core structure traps heat efficiently while remaining astonishingly lightweight. Its micron count (14-19µ) is finer than most wools, creating a sensorial handfeel unmatched by other animal fibres. Though not as durable as merino, high-quality cashmere develops a beautiful patina over time when cared for properly.

Compared to lambswool, cashmere offers 3x the insulating power at half the weight, with superior drape and next-to-skin comfort. It blends exceptionally with silk for added sheen or merino for enhanced resilience. Designers often reserve 100% cashmere for heritage knits where its tactile luxury can shine.

Choose cashmere when seeking unparalleled softness in cold-weather layers. It''s the ultimate choice for discerning customers who appreciate time-honoured craftsmanship and fibres that improve with age.'::text, NULL::text, ARRAY['information_card','accordion']::public.knowledge_display_type[], 'justify_premium'::public.knowledge_commercial_intent, 0::integer, true::boolean, now(), now(), NULL),
  ('da000000-0000-4000-8000-000000000004'::uuid, NULL, 'fibre'::public.knowledge_topic, E'Cashmere Cotton Blend'::text, 'cashmere-cotton-blend'::text, E'Luxurious softness meets breathable comfort in this refined blend of premium fibres.'::text, E'Cashmere cotton blends combine the ultra-soft warmth of cashmere goat fibres with the lightweight breathability of natural cotton. The cashmere comes from the undercoat of Himalayan goats, hand-combed for premium quality, while the cotton adds structure and cooling properties.

This blend offers the supple drape and luxurious handle of cashmere with improved durability and easier care from the cotton content. It''s warmer than pure cotton yet more breathable than 100% cashmere, making it versatile across seasons. The cotton also helps reduce pilling common in pure cashmere garments.

Ideal for customers who want cashmere''s indulgence with everyday practicality, this blend works beautifully in lightweight knitwear and transitional layers. Choose it when you desire softness without overheating, or when seeking premium comfort with slightly easier maintenance than pure cashmere requires.'::text, NULL::text, ARRAY['information_card','accordion']::public.knowledge_display_type[], 'justify_premium'::public.knowledge_commercial_intent, 0::integer, true::boolean, now(), now(), NULL),
  ('da000000-0000-4000-8000-000000000005'::uuid, NULL, 'fibre'::public.knowledge_topic, E'Cotton Drill'::text, 'cotton-drill'::text, E'A tightly woven, durable cotton fabric with a diagonal weave, ideal for structured garments and hardwearing style.'::text, E'Cotton drill is a robust fabric woven from 100% cotton yarns using a diagonal twill weave technique. This construction gives it a distinctive ridged texture and exceptional strength. The cotton fibers are sourced from the fluffy bolls of the cotton plant, predominantly grown in warm climates like India, the USA, and Egypt. The yarns are tightly spun and woven to create a dense, hardwearing material.

Cotton drill has a crisp handle with a slight stiffness that softens over time, making it ideal for structured garments like chore jackets, workwear, and military-inspired clothing. It offers moderate breathability due to its dense weave, with decent warmth for a cotton fabric. The diagonal weave enhances durability, resisting tears and abrasions better than plain-weave cottons. Its drape is utilitarian rather than fluid, holding its shape well.

Compared to lighter cotton fabrics like poplin or voile, drill is substantially heavier and more hardwearing. It blends well with synthetic fibers like polyester for added wrinkle resistance, though pure cotton drill develops a desirable lived-in patina. Choose cotton drill when you need a tough yet breathable fabric for garments that should stand up to regular wear while maintaining a clean, tailored silhouette.'::text, NULL::text, ARRAY['information_card','accordion']::public.knowledge_display_type[], 'educate'::public.knowledge_commercial_intent, 0::integer, true::boolean, now(), now(), NULL),
  ('da000000-0000-4000-8000-000000000006'::uuid, NULL, 'fibre'::public.knowledge_topic, E'Cotton Linen Blend'::text, 'cotton-linen-blend'::text, E'A breathable, textured fabric that balances cotton''s softness with linen''s natural crispness for warm-weather refinement.'::text, E'Cotton linen blends combine cotton fibers, harvested from the cotton plant''s seed pods, with linen fibers derived from the flax plant''s sturdy stalks. Cotton provides softness and absorbency, while linen contributes superior breathability and a distinctive slubbed texture. The blend typically ranges from 55% cotton/45% linen to 70% cotton/30% linen, balancing both fibers'' best qualities.

This fabric excels in warm climates, offering exceptional air circulation that wicks moisture away from the body. The linen component ensures quick drying and resists pilling, while the cotton prevents the stiffness sometimes associated with pure linen. Though slightly heavier than pure cotton, it drapes well with a lived-in elegance that improves with wear.

Compared to pure cotton, cotton linen blends maintain shape better and resist wrinkling more effectively than 100% linen. They pair exceptionally well with wool for cooler-weather textiles that retain breathability. The natural, slightly textured appearance works particularly well for casual tailoring and relaxed summer separates.

Choose this blend when you want the easy comfort of cotton with linen''s elevated, breathable performance. It''s ideal for warm-weather shirting, unstructured jackets, and trousers where subtle texture adds character without sacrificing comfort.'::text, NULL::text, ARRAY['information_card','accordion']::public.knowledge_display_type[], 'upgrade'::public.knowledge_commercial_intent, 0::integer, true::boolean, now(), now(), NULL),
  ('da000000-0000-4000-8000-000000000007'::uuid, NULL, 'fibre'::public.knowledge_topic, E'Linen'::text, 'linen'::text, E'The ultimate summer fabric: breathable, lightweight, and effortlessly elegant with a lived-in texture.'::text, E'Linen comes from the flax plant, one of the oldest cultivated fibres in the world. The stalks are harvested, retted (soaked to break down pectin), and scutched to separate the long, strong fibres. These are then spun into yarn, often with a slightly irregular texture that gives linen its characteristic slubby appearance.

Linen is prized for its exceptional breathability and moisture-wicking properties, making it ideal for warm weather. It has a crisp, dry hand that softens with wear, developing a relaxed drape and subtle creases that are part of its charm. While not as elastic as wool, high-quality linen is surprisingly durable and becomes stronger when wet.

Compared to cotton, linen is more breathable and dries faster, though it wrinkles more easily. It blends beautifully with cotton for added softness or with silk for a refined sheen. Linen suits relaxed tailoring, unstructured jackets, and summer shirting where comfort and natural elegance take precedence over a perfectly pressed look.'::text, NULL::text, ARRAY['information_card','accordion']::public.knowledge_display_type[], 'educate'::public.knowledge_commercial_intent, 0::integer, true::boolean, now(), now(), NULL),
  ('da000000-0000-4000-8000-000000000008'::uuid, NULL, 'fibre'::public.knowledge_topic, E'Silk'::text, 'silk'::text, E'Luxurious, lightweight, and naturally lustrous, silk is the ultimate choice for refined elegance and comfort.'::text, E'Silk is a natural protein fiber produced by silkworms, primarily the Bombyx mori species, which spin cocoons during their larval stage. These cocoons are carefully harvested, boiled to soften the sericin (a protective gum), and then unraveled into long, continuous threads. The process is labor-intensive, contributing to silk''s premium status.

Silk is renowned for its smooth, soft handle and luminous sheen. It is lightweight yet surprisingly strong, with excellent temperature-regulating properties—keeping you cool in summer and warm in winter. The fiber breathes well, resists odors, and drapes beautifully, making it ideal for tailored suits, shirting, and accessories.

Compared to synthetic alternatives, silk is more delicate and requires gentle care, but its natural elegance is unmatched. It blends well with wool for added warmth or with cotton for a softer, more casual feel. Designers often use silk to elevate formalwear or create lightweight summer layers.

Choose silk when you seek timeless sophistication, comfort, and a touch of luxury. It’s perfect for special occasions, warm-weather tailoring, or any piece where drape and luster matter.'::text, NULL::text, ARRAY['information_card','accordion']::public.knowledge_display_type[], 'justify_premium'::public.knowledge_commercial_intent, 0::integer, true::boolean, now(), now(), NULL),
  ('da000000-0000-4000-8000-000000000009'::uuid, NULL, 'fibre'::public.knowledge_topic, E'Silk Linen Blend'::text, 'silk-linen-blend'::text, E'A luxurious yet breathable fusion of silk''s sheen and linen''s crisp texture, perfect for warm-weather elegance.'::text, E'Silk linen blends combine the finest qualities of two natural fibres. Silk, harvested from silkworm cocoons, is known for its lustrous sheen and smooth handle, while linen, derived from flax plant stalks, offers a crisp, textured feel and exceptional breathability. The blend balances these traits, creating a fabric that is both refined and practical.

This blend excels in warm climates, as linen''s airy structure allows heat to escape while silk adds a subtle drape and softness. The result is a fabric that resists wrinkling better than pure linen and feels lighter than pure silk. It maintains linen''s durability and silk''s natural temperature-regulating properties, making it a versatile choice for tailored shirts, lightweight suits, or relaxed summer jackets.

Compared to other summer fabrics like cotton or pure linen, a silk linen blend offers a more elevated look with its gentle sheen and fluid movement. It pairs well with wool for cooler evenings or can be layered over lightweight knits. Choose this blend when you want effortless sophistication without sacrificing comfort in warmer weather.'::text, NULL::text, ARRAY['information_card','accordion']::public.knowledge_display_type[], 'upgrade'::public.knowledge_commercial_intent, 0::integer, true::boolean, now(), now(), NULL),
  ('da000000-0000-4000-8000-000000000010'::uuid, NULL, 'fibre'::public.knowledge_topic, E'Super 150s Wool'::text, 'super-150s-wool'::text, E'Ultra-fine merino wool for the most luxurious, lightweight suits and knitwear.'::text, E'Super 150s refers to the fineness of wool fibers, measured in microns. It comes from select merino sheep, bred for their exceptionally fine fleece. The ''150'' denotes that one pound of wool can spin 150 skeins of yarn, each 560 yards long. This ultra-fine grading is achieved through careful breeding and optimal grazing conditions, often in Australia or New Zealand.

Super 150s wool is prized for its incredibly soft handle and lightweight drape. Despite its fineness, it maintains good breathability and natural temperature regulation. It is less durable than thicker wools, making it best for formalwear or luxury knitwear rather than everyday use. The fibers have a subtle luster and silky smoothness that elevates any garment.

Compared to standard merino (Super 100s-120s), Super 150s offers unparalleled refinement but requires more care. It is sometimes blended with silk or cashmere for added strength and luxury. Choose Super 150s for black-tie suits, high-end scarves, or when you want the absolute finest wool without compromising comfort.'::text, NULL::text, ARRAY['information_card','accordion']::public.knowledge_display_type[], 'justify_premium'::public.knowledge_commercial_intent, 0::integer, true::boolean, now(), now(), NULL),
  ('da000000-0000-4000-8000-000000000011'::uuid, NULL, 'fibre'::public.knowledge_topic, E'Vicuña'::text, 'vicu-a'::text, E'The rarest, most luxurious natural fibre, prized for its unmatched softness and warmth.'::text, E'Vicuña fibre comes from the vicuña, a wild relative of the alpaca found in the high Andes of Peru, Bolivia, Chile, and Argentina. Their fine, lightweight fleece is sheared every few years in a sustainable, government-regulated process that protects the species. Vicuña produces the finest and lightest natural fibre in the world, with a micron count as low as 12—finer than cashmere or silk.

Vicuña wool is exceptionally soft, warm, and lightweight, with a delicate handle and a natural golden hue. It has excellent thermal properties, trapping heat without bulk, and is highly breathable. However, it lacks the durability of coarser wools and requires careful handling. Its rarity and labor-intensive harvesting make it one of the most expensive fibres globally.

Vicuña is often compared to cashmere but is even softer, lighter, and more exclusive. It is rarely blended due to its premium status, though some luxury fabrics combine it with silk or ultra-fine merino for added strength. Choose vicuña for the ultimate in understated luxury, ideal for lightweight scarves, rare overcoats, or investment-grade suiting where exclusivity and unparalleled softness are paramount.'::text, NULL::text, ARRAY['information_card','accordion']::public.knowledge_display_type[], 'justify_premium'::public.knowledge_commercial_intent, 0::integer, true::boolean, now(), now(), NULL),
  ('da000000-0000-4000-8000-000000000012'::uuid, NULL, 'fibre'::public.knowledge_topic, E'Wool'::text, 'wool'::text, E'Nature''s original performance fibre, balancing warmth, breathability and resilience.'::text, E'Wool comes from the fleece of sheep, with Merino varieties offering the finest, softest fibres. It is sheared annually, then cleaned, carded, and spun into yarn. Wool’s natural crimp creates insulating air pockets, making it remarkably warm yet breathable—perfect for regulating body temperature in changing conditions.

Wool is inherently durable, elastic, and resistant to wrinkles, with natural moisture-wicking and odour-resistant properties. Its handle ranges from crisp worsteds to lofty tweeds, offering versatility in texture and drape. Unlike synthetic fibres, wool biodegrades and is renewable, aligning with sustainable values.

While pure wool excels in tailored garments and cold-weather layers, it blends beautifully with silk for refined lustre or nylon for added strength. Choose wool when seeking timeless, high-performance textiles that adapt to both formal and outdoor wear.'::text, NULL::text, ARRAY['information_card','accordion']::public.knowledge_display_type[], 'justify_premium'::public.knowledge_commercial_intent, 0::integer, true::boolean, now(), now(), NULL),
  ('da000000-0000-4000-8000-000000000013'::uuid, NULL, 'fibre'::public.knowledge_topic, E'Wool Cashmere Blend'::text, 'wool-cashmere-blend'::text, E'Luxurious warmth meets durability in this refined blend of fine wools and rare cashmere fibers.'::text, E'Wool cashmere blends combine the finest wool fibers with rare cashmere, typically from the undercoat of Himalayan goats. The wool provides structure and durability, while cashmere contributes unparalleled softness and insulating properties. This fusion creates a fabric that maintains the best qualities of both fibers.

The handle is luxuriously soft with a subtle loft, offering exceptional warmth-to-weight ratio. The blend breathes naturally, regulating temperature better than pure wool, while maintaining superior drape and resistance to pilling. It outperforms regular wool in softness and surpasses pure cashmere in durability and shape retention.

Ideal for discerning customers who seek everyday luxury, this blend elevates tailored coats, premium sweaters and refined accessories. Choose it when you desire the indulgence of cashmere with the practicality of wool – perfect for investment pieces that bridge formal and casual wear.'::text, NULL::text, ARRAY['information_card','accordion']::public.knowledge_display_type[], 'justify_premium'::public.knowledge_commercial_intent, 0::integer, true::boolean, now(), now(), NULL),
  ('da000000-0000-4000-8000-000000000014'::uuid, NULL, 'fibre'::public.knowledge_topic, E'Wool Mohair Fresco'::text, 'wool-mohair-fresco'::text, E'A crisp, breathable blend of wool and mohair, perfected for structured summer tailoring with enduring elegance.'::text, E'Wool mohair fresco is a refined fabric combining fine wool and lustrous mohair, woven in an open fresco weave for optimal breathability. Wool provides resilience and natural temperature regulation, while mohair—sourced from the Angora goat—adds a subtle sheen and exceptional durability. The fresco weaving technique creates tiny air pockets, enhancing ventilation without sacrificing structure.

This blend excels in warm-weather suiting, offering a crisp handle and lightweight drape that resists wrinkling. Mohair’s inherent strength prevents sagging, ensuring sharp lines over time, while wool’s moisture-wicking properties maintain comfort. Compared to pure wool fresco, the mohair blend is more resilient and retains its shape better in humid conditions.

Ideal for summer suits and sport coats, wool mohair fresco bridges formality and practicality. Choose it for occasions demanding both polish and breathability, or when a fabric must withstand frequent wear without losing its refined appearance. It’s a premium alternative to tropical wools, with added longevity from mohair’s hardy fibers.'::text, NULL::text, ARRAY['information_card','accordion']::public.knowledge_display_type[], 'justify_premium'::public.knowledge_commercial_intent, 0::integer, true::boolean, now(), now(), NULL),
  ('da000000-0000-4000-8000-000000000015'::uuid, NULL, 'fibre'::public.knowledge_topic, E'Wool Silk Blend'::text, 'wool-silk-blend'::text, E'Luxurious union of warmth and refinement, offering structure with a delicate luster.'::text, E'Wool silk blends combine the rugged warmth of wool fibres, typically sourced from sheep, with the delicate strength and natural sheen of silk, produced by silkworms. This marriage creates a yarn that maintains wool''s insulating properties while gaining silk''s smooth surface and drape. The blend ratio varies, but common compositions balance wool''s resilience with silk''s elegance (e.g. 70/30 or 60/40).

In handle, wool silk fabrics are lighter than pure wool yet warmer than pure silk, with a subtle luminosity that catches light without appearing shiny. The wool fibres provide natural elasticity and wrinkle resistance, while silk adds breathability and moisture-wicking properties uncommon in standard woolens. Unlike coarse wools, these blends feel noticeably softer against the skin.

Compared to wool-cashmere blends, wool silk offers crisper drape for tailored garments while retaining warmth. It bridges the gap between formal suiting wool and casual knitwear fibres. Ideal for autumn-winter tailoring or structured casualwear where muted luster is desired—think travel blazers, luxury cardigans, or drape-forward overcoats that transition from day to evening.'::text, NULL::text, ARRAY['information_card','accordion']::public.knowledge_display_type[], 'upgrade'::public.knowledge_commercial_intent, 0::integer, true::boolean, now(), now(), NULL),
  ('da000000-0000-4000-8000-000000000016'::uuid, NULL, 'fibre'::public.knowledge_topic, E'Wool Silk Linen Blend'::text, 'wool-silk-linen-blend'::text, E'A refined, breathable blend offering the best of natural fibres for year-round comfort and sophistication.'::text, E'This luxurious blend combines wool, silk, and linen, each sourced from natural origins. Wool is sheared from sheep, silk is spun by silkworms, and linen is derived from the flax plant. Together, they create a fabric with exceptional balance and versatility.

The handle is soft yet crisp, with wool providing warmth and resilience, silk adding a subtle sheen and smoothness, and linen contributing breathability and structure. The blend drapes elegantly while remaining breathable, making it suitable for both cooler and warmer climates. It resists wrinkles better than pure linen and feels lighter than traditional wool.

Compared to single-fibre fabrics, this blend offers a unique harmony of properties. Wool ensures durability, silk enhances comfort, and linen keeps the fabric fresh. It’s ideal for tailored jackets, lightweight suits, or refined casualwear that transitions seamlessly between seasons.

Choose this blend for garments that demand a polished look without sacrificing comfort. It’s perfect for discerning customers who appreciate natural fibres with balanced performance and understated luxury.'::text, NULL::text, ARRAY['information_card','accordion']::public.knowledge_display_type[], 'justify_premium'::public.knowledge_commercial_intent, 0::integer, true::boolean, now(), now(), NULL)
ON CONFLICT (slug) WHERE retailer_id IS NULL DO UPDATE SET
  summary = excluded.summary,
  body = excluded.body,
  topic = 'fibre'::public.knowledge_topic,
  updated_at = now(),
  deleted_at = null;

INSERT INTO public.knowledge_object_concepts (id, knowledge_object_id, concept_id, match_strength, created_at, updated_at, deleted_at)
SELECT gen_random_uuid(), ko.id, c.id, 1::numeric, now(), now(), NULL
FROM (VALUES
  ('alpaca-wool', 'alpaca-wool'),
  ('camel-hair', 'camel-hair'),
  ('cashmere', 'cashmere'),
  ('cashmere-cotton-blend', 'cashmere-cotton-blend'),
  ('cotton-drill', 'cotton-drill'),
  ('cotton-linen-blend', 'cotton-linen-blend'),
  ('linen', 'linen'),
  ('silk', 'silk'),
  ('silk-linen-blend', 'silk-linen-blend'),
  ('super-150s-wool', 'super-150s'),
  ('vicu-a', 'vicu-a'),
  ('wool', 'wool'),
  ('wool-cashmere-blend', 'wool-cashmere-blend'),
  ('wool-mohair-fresco', 'wool-mohair-fresco'),
  ('wool-silk-blend', 'wool-silk-blend'),
  ('wool-silk-linen-blend', 'wool-silk-linen-blend')
) AS v(ko_slug, concept_slug)
JOIN public.knowledge_objects ko ON ko.slug = v.ko_slug AND ko.retailer_id IS NULL
JOIN public.metadata_concepts c ON c.kind = 'fibre'::public.metadata_concept_kind AND c.slug = v.concept_slug AND c.retailer_id IS NULL
ON CONFLICT (knowledge_object_id, concept_id) WHERE deleted_at IS NULL DO NOTHING;
