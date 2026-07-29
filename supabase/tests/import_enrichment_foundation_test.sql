-- Tenant isolation for import enrichment prompt contracts and AI review fields.

begin;
select plan(4);

select has_table('public', 'import_enrichment_prompt_contracts',
  'import enrichment prompt contracts table exists');

select has_column('public', 'metadata_review_tasks', 'evidence',
  'metadata review tasks retain AI evidence');

select has_column('public', 'metadata_review_tasks', 'field_key',
  'metadata review tasks retain AI field keys for idempotency');

select ok(
  exists (
    select 1
    from public.import_enrichment_prompt_contracts
    where slug = 'catalogue_import_external_v1'
      and active = true
  ),
  'seeded catalogue import enrichment prompt is active'
);

select * from finish();
rollback;
