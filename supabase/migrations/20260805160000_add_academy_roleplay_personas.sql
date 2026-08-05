-- PHASE 17.8 (ADV-108): a published roleplay-persona catalog, layered
-- onto the existing academy_roleplay_grades grading loop (16.1) rather
-- than a second one. Nullable — a grade with no persona is still a
-- valid grade, matching data recorded before this column existed — but
-- when set, it must be one of the published catalog keys, enforced in
-- SQL, not just in the calling form.

alter table public.academy_roleplay_grades
  add column if not exists persona_key text
    check (
      persona_key is null or persona_key in (
        'first_time_buyer', 'browser', 'know_it_all', 'couple',
        'complaint_handling', 'white_glove'
      )
    );

comment on column public.academy_roleplay_grades.persona_key is
  'PHASE 17.8 / ADV-108. Which published training persona this roleplay '
  'was practiced against. Nullable for grades predating this column.';
