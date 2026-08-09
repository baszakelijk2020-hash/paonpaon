begin;
select plan(15);

insert into public.retailers (
  id, legal_name, display_name, slug, status
) values (
  'e2000000-0000-0000-0000-000000000001',
  'Roleplay Academy Test Ltd',
  'Roleplay Academy Test',
  'roleplay-academy-test',
  'active'
), (
  'e2000000-0000-0000-0000-00000000000b',
  'Other Roleplay House Ltd',
  'Other Roleplay House',
  'other-roleplay-house',
  'active'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'e2000000-0000-0000-0000-000000000002',
  'authenticated', 'authenticated', 'roleplay-advisor@example.test',
  '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  'e2000000-0000-0000-0000-000000000003',
  'authenticated', 'authenticated', 'roleplay-manager@example.test',
  '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  'e2000000-0000-0000-0000-000000000004',
  'authenticated', 'authenticated', 'roleplay-other-advisor@example.test',
  '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  'e2000000-0000-0000-0000-00000000000a',
  'authenticated', 'authenticated', 'other-house-roleplay-advisor@example.test',
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.retailer_staff_members (
  id, retailer_id, user_id, full_name, email, role, accepted_at
) values (
  'e2000000-0000-0000-0000-000000000005',
  'e2000000-0000-0000-0000-000000000001',
  'e2000000-0000-0000-0000-000000000002',
  'Roleplay Advisor', 'roleplay-advisor@example.test', 'sales_associate', now()
), (
  'e2000000-0000-0000-0000-000000000006',
  'e2000000-0000-0000-0000-000000000001',
  'e2000000-0000-0000-0000-000000000003',
  'Roleplay Manager', 'roleplay-manager@example.test', 'manager', now()
), (
  'e2000000-0000-0000-0000-000000000007',
  'e2000000-0000-0000-0000-000000000001',
  'e2000000-0000-0000-0000-000000000004',
  'Roleplay Other Advisor', 'roleplay-other-advisor@example.test', 'sales_associate', now()
), (
  'e2000000-0000-0000-0000-00000000000c',
  'e2000000-0000-0000-0000-00000000000b',
  'e2000000-0000-0000-0000-00000000000a',
  'Other House Roleplay Advisor', 'other-house-roleplay-advisor@example.test',
  'manager', now()
);

-- Unknown persona is refused before any row is written.
set local role authenticated;
set local request.jwt.claim.sub = 'e2000000-0000-0000-0000-000000000002';
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claims = '{
  "sub": "e2000000-0000-0000-0000-000000000002",
  "role": "authenticated"
}';

select throws_ok(
  $$
    select public.start_academy_roleplay_session(
      'e2000000-0000-0000-0000-000000000001', 'not_a_real_persona'
    )
  $$,
  'P0001',
  'Unknown persona',
  'unknown persona key is refused'
);

-- Cross-tenant start attempt (real user, wrong retailer_id) is refused.
select throws_ok(
  $$
    select public.start_academy_roleplay_session(
      'e2000000-0000-0000-0000-00000000000b', 'browser'
    )
  $$,
  'P0001',
  'Not an accepted staff member of this retailer',
  'starting a session for a retailer the caller does not staff is refused'
);

-- Real start.
select isnt(
  (select id from public.start_academy_roleplay_session(
    'e2000000-0000-0000-0000-000000000001', 'browser'
  )),
  null,
  'a real session is created for an accepted staff member'
);

select results_eq(
  $$
    select status, persona_key, turn_count
    from public.academy_roleplay_sessions
    where staff_id = 'e2000000-0000-0000-0000-000000000005'
  $$,
  $$ values ('active'::text, 'browser'::text, 0) $$,
  'the created session is active, carries the requested persona and starts at zero turns'
);

-- Starting again resumes the same session rather than forking a second one.
select is(
  (select count(*)::int from public.academy_roleplay_sessions
   where staff_id = 'e2000000-0000-0000-0000-000000000005'),
  1,
  'a second start call resumes the existing active session instead of creating a duplicate'
);

set local role none;
select set_config(
  'app.roleplay_session_id',
  (select id::text from public.academy_roleplay_sessions
   where staff_id = 'e2000000-0000-0000-0000-000000000005'),
  false
);

-- Empty advisor/persona text is refused.
set local role authenticated;
set local request.jwt.claim.sub = 'e2000000-0000-0000-0000-000000000002';
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claims = '{
  "sub": "e2000000-0000-0000-0000-000000000002",
  "role": "authenticated"
}';

select throws_ok(
  format(
    $$select public.submit_academy_roleplay_turn('%s', '', 'a persona reply')$$,
    current_setting('app.roleplay_session_id')
  ),
  'P0001',
  'Advisor line cannot be empty',
  'an empty advisor line is refused'
);

-- Another advisor cannot write into this session.
set local role none;
set local role authenticated;
set local request.jwt.claim.sub = 'e2000000-0000-0000-0000-000000000004';
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claims = '{
  "sub": "e2000000-0000-0000-0000-000000000004",
  "role": "authenticated"
}';

select throws_ok(
  format(
    $$select public.submit_academy_roleplay_turn('%s', 'not my session', 'a persona reply')$$,
    current_setting('app.roleplay_session_id')
  ),
  'P0001',
  'Session not found or not owned by the caller',
  'a different advisor cannot write into someone else''s session'
);

-- A cross-House advisor cannot write into this session either.
set local role none;
set local role authenticated;
set local request.jwt.claim.sub = 'e2000000-0000-0000-0000-00000000000a';
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claims = '{
  "sub": "e2000000-0000-0000-0000-00000000000a",
  "role": "authenticated"
}';

select throws_ok(
  format(
    $$select public.submit_academy_roleplay_turn('%s', 'not my house', 'a persona reply')$$,
    current_setting('app.roleplay_session_id')
  ),
  'P0001',
  'Session not found or not owned by the caller',
  'a cross-House advisor cannot write into this session'
);

-- Real turn submission by the owning advisor.
set local role none;
set local role authenticated;
set local request.jwt.claim.sub = 'e2000000-0000-0000-0000-000000000002';
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claims = '{
  "sub": "e2000000-0000-0000-0000-000000000002",
  "role": "authenticated"
}';

select is(
  (select count(*)::int from
    public.submit_academy_roleplay_turn(
      current_setting('app.roleplay_session_id')::uuid,
      'Hi, I am just looking around today.',
      'Welcome in! Take your time browsing — let me know if anything catches your eye.'
    )
  ),
  2,
  'submitting one turn inserts exactly the advisor line and the persona reply'
);

select results_eq(
  format(
    $$select turn_index, speaker from public.academy_roleplay_messages
      where session_id = '%s' order by turn_index$$,
    current_setting('app.roleplay_session_id')
  ),
  $$ values (0, 'advisor'::text), (1, 'persona'::text) $$,
  'the transcript records the advisor line before the persona reply, in strict order'
);

select is(
  (select turn_count from public.academy_roleplay_sessions
   where id::text = current_setting('app.roleplay_session_id')),
  2,
  'the session turn_count advances by the number of messages written'
);

-- A manager of the same House can read the transcript; a cross-House manager cannot.
set local role none;
set local role authenticated;
set local request.jwt.claim.sub = 'e2000000-0000-0000-0000-000000000003';
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claims = '{
  "sub": "e2000000-0000-0000-0000-000000000003",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "e2000000-0000-0000-0000-000000000001",
    "retailer_role": "manager"
  }
}';

select is(
  (select count(*)::int from public.academy_roleplay_messages
   where session_id::text = current_setting('app.roleplay_session_id')),
  2,
  'a same-House manager can read the full transcript'
);

set local role none;
set local role authenticated;
set local request.jwt.claim.sub = 'e2000000-0000-0000-0000-00000000000a';
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claims = '{
  "sub": "e2000000-0000-0000-0000-00000000000a",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "e2000000-0000-0000-0000-00000000000b",
    "retailer_role": "manager"
  }
}';

select is(
  (select count(*)::int from public.academy_roleplay_messages
   where session_id::text = current_setting('app.roleplay_session_id')),
  0,
  'a cross-House manager cannot read this transcript'
);

-- Ending the session by its owning advisor works; a second end attempt fails
-- because the session is no longer active.
set local role none;
set local role authenticated;
set local request.jwt.claim.sub = 'e2000000-0000-0000-0000-000000000002';
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claims = '{
  "sub": "e2000000-0000-0000-0000-000000000002",
  "role": "authenticated"
}';

select results_eq(
  format(
    $$select status from public.end_academy_roleplay_session('%s', 'completed')$$,
    current_setting('app.roleplay_session_id')
  ),
  $$ values ('completed'::text) $$,
  'the owning advisor can end their own session'
);

select throws_ok(
  format(
    $$select public.end_academy_roleplay_session('%s', 'completed')$$,
    current_setting('app.roleplay_session_id')
  ),
  'P0001',
  'Session not found, not owned by the caller, or already ended',
  'ending an already-ended session is refused'
);

select * from finish();
rollback;
