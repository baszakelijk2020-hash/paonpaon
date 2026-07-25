-- fitting_observations (20260719000101) is explicitly append-only by its
-- own table comment, but the only existing write path is the one-time
-- create_alteration_intake transaction — there was never a way to append a
-- later observation against an already-intaken garment. The voice
-- measurement slider and silhouette carousel (pag1's `vox-`/`nbs-
-- silhouette-` widgets) are meant to be used across a garment's fitting
-- lifecycle (re-fittings, refinements), not just once at intake, so this
-- fills a real gap rather than working around the existing shape.
--
-- Each call opens a new fitting_session — a follow-up fitting is a
-- genuinely new encounter, never conflated with the intake session.
create or replace function public.add_fitting_observation(
  p_physical_garment_id uuid,
  p_area text,
  p_observation text,
  p_classification public.work_classification default 'work_now'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_garment public.physical_garments%rowtype;
  v_staff_id uuid;
  v_session_id uuid;
  v_observation_id uuid;
begin
  select * into v_garment from public.physical_garments
    where id = p_physical_garment_id and deleted_at is null;
  if not found then raise exception 'Garment not found'; end if;
  if v_garment.retailer_id <> public.current_retailer_id() then
    raise exception 'Not authorized';
  end if;
  if not public.is_alterations_advisor() then
    raise exception 'Not authorized';
  end if;
  v_staff_id := public.current_staff_id();

  if length(trim(coalesce(p_area, ''))) not between 2 and 120
    or length(trim(coalesce(p_observation, ''))) not between 2 and 2000
  then raise exception 'Fitting observation is invalid'; end if;

  insert into public.fitting_sessions (
    retailer_id, customer_id, fitted_by_staff_id, notes
  ) values (
    v_garment.retailer_id, v_garment.customer_id, v_staff_id,
    'Fit-tool follow-up observation'
  ) returning id into v_session_id;

  insert into public.fitting_observations (
    retailer_id, fitting_session_id, physical_garment_id, classification,
    area, observation, recorded_by_staff_id
  ) values (
    v_garment.retailer_id, v_session_id, p_physical_garment_id,
    p_classification, trim(p_area), trim(p_observation), v_staff_id
  ) returning id into v_observation_id;

  return v_observation_id;
end;
$$;

revoke all on function public.add_fitting_observation(uuid, text, text, public.work_classification) from public;
grant execute on function public.add_fitting_observation(uuid, text, text, public.work_classification) to authenticated, service_role;
