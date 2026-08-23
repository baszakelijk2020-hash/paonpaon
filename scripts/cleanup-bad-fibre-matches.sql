-- The first broad pass matched any fibre concept containing "wool" in its
-- slug (e.g. wool-silk-blend, wool-cashmere-blend, wool-mohair-fresco) to
-- any product containing "wool" in its name, without checking whether the
-- OTHER fibres in that compound concept actually appear in the product.
-- Result: products got assigned to blends they aren't made of.
--
-- Fix: for every 'paon'-sourced fibre assignment, require every
-- hyphen-separated word in the concept slug (after stripping the trailing
-- "-blend"/"-fresco"/etc. filler) to literally appear in the product name.
-- Anything that fails this check is soft-deleted.

with word_check as (
  select
    e.id as assignment_id,
    e.target_id,
    p.name as product_name,
    c.slug as concept_slug,
    -- split slug into candidate fibre words, drop generic suffixes
    array_remove(
      array(
        select w from unnest(string_to_array(c.slug, '-')) as w
        where w not in ('blend', 'fresco', 's', 'super')
      ),
      null
    ) as fibre_words
  from entity_metadata_assignments e
  join metadata_concepts c on c.id = e.concept_id
  join products p on p.id = e.target_id
  where e.source = 'paon'
    and c.kind = 'fibre'
    and e.deleted_at is null
)
update entity_metadata_assignments e
set deleted_at = now()
from word_check wc
where e.id = wc.assignment_id
  and not (
    select bool_and(wc.product_name ilike '%' || fw || '%')
    from unnest(wc.fibre_words) as fw
  );

select count(*) as remaining_active_assignments
from entity_metadata_assignments where deleted_at is null;
