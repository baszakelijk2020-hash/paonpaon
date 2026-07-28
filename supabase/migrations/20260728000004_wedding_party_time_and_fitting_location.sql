-- Fitting party needs a clock time and a shop address separate from the
-- wedding venue (PHASE.md queue item 6 step 4). Location as an entity is
-- still deferred (ROADMAP Phase 1); fitting_location is free text for now.
alter table public.wedding_parties
  add column event_time time,
  add column fitting_location text;
