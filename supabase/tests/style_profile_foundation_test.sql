-- StyleProfile foundation assertions (PHASE 3.2).

begin;
select plan(13);

select has_table('public', 'customer_style_profiles',
  'style profiles table exists');

select has_table(
  'public',
  'customer_style_preference_evidence',
  'style preference evidence table exists'
);

select has_column('public', 'customer_style_profiles', 'explicit_preferences',
  'explicit preferences column exists');

select has_column('public', 'customer_style_profiles', 'inferred_preferences',
  'inferred preferences column exists');

select has_column('public', 'customer_style_preference_evidence', 'polarity',
  'evidence polarity column exists');

select has_column('public', 'customer_style_preference_evidence', 'suppressed_at',
  'evidence soft-suppression column exists');

select ok(
  exists (
    select 1 from pg_proc
    where proname = 'upsert_declared_style_preference'
  ),
  'upsert_declared_style_preference RPC exists'
);

select ok(
  exists (
    select 1 from pg_proc
    where proname = 'remove_inferred_style_preference'
  ),
  'remove_inferred_style_preference RPC exists'
);

select ok(
  exists (
    select 1 from pg_proc
    where proname = 'record_style_preference_evidence'
  ),
  'record_style_preference_evidence RPC exists'
);

select ok(
  exists (
    select 1 from pg_proc
    where proname = 'persist_style_profile_recompute'
  ),
  'persist_style_profile_recompute RPC exists'
);

select has_index(
  'public',
  'customer_style_preference_evidence',
  'customer_style_evidence_source_concept_uidx',
  'event-derived evidence is unique per source event and concept'
);

select function_returns(
  'public',
  'record_style_preference_evidence',
  array['uuid', 'uuid', 'text', 'text', 'numeric', 'uuid'],
  'customer_style_preference_evidence',
  'evidence command returns the persisted evidence row'
);

select ok(
  position(
    'Source event does not match evidence subject and source'
    in pg_get_functiondef(
      'public.record_style_preference_evidence(uuid,uuid,text,text,numeric,uuid)'::regprocedure
    )
  ) > 0,
  'evidence command verifies event provenance'
);

select * from finish();
rollback;
