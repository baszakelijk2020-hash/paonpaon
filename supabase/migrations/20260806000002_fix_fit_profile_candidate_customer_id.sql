-- fitting_observations has no customer_id column (only physical_garment_id);
-- 20260806000000's propose_fit_profile_candidate() cast physical_garment_id
-- itself into fit_profile_candidates.customer_id, which fails the column's
-- own foreign key to customers on every real call (a garment id is never a
-- customer id) — caught wiring the first real caller of this RPC, not by
-- the original migration's pgTAP coverage, which never exercised the
-- actual insert path end to end. Fixed by deriving the real customer id
-- from physical_garments, the same table that already carries it.
create or replace function public.propose_fit_profile_candidate(
  p_observation_ids uuid[],
  p_proposed_measurements jsonb,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_first_observation public.fitting_observations%rowtype;
  v_customer_id uuid;
  v_candidate_id uuid;
  v_observation_id uuid;
  v_staff_id uuid;
  v_existing_candidate_id uuid;
begin
  if not public.is_alterations_advisor() then
    raise exception 'Not authorized to propose fit profile candidates';
  end if;
  if array_length(p_observation_ids, 1) < 1 then
    raise exception 'At least one observation is required';
  end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) = 0 then
    raise exception 'Idempotency key is required';
  end if;

  -- Idempotency: check if this key already resulted in a candidate.
  select id into v_existing_candidate_id from public.fit_profile_candidates
    where idempotency_key = p_idempotency_key
    limit 1;
  if v_existing_candidate_id is not null then
    return v_existing_candidate_id;
  end if;

  -- Validate first observation exists and belongs to this retailer.
  select * into v_first_observation from public.fitting_observations
    where id = p_observation_ids[1];
  if not found then
    raise exception 'First observation not found';
  end if;
  if v_first_observation.retailer_id <> public.current_retailer_id() then
    raise exception 'Not authorized to access this observation';
  end if;

  -- Validate all observations: same physical garment, same retailer.
  foreach v_observation_id in array p_observation_ids loop
    perform 1 from public.fitting_observations
      where id = v_observation_id
        and physical_garment_id = v_first_observation.physical_garment_id
        and retailer_id = public.current_retailer_id();
    if not found then
      raise exception 'Observation does not match garment or retailer';
    end if;
  end loop;

  select customer_id into v_customer_id from public.physical_garments
    where id = v_first_observation.physical_garment_id;
  if v_customer_id is null then
    raise exception 'Garment has no owning customer';
  end if;

  v_staff_id := public.current_staff_id();

  -- Create the candidate.
  insert into public.fit_profile_candidates (
    retailer_id, customer_id, fitting_session_id, status,
    proposed_measurements, idempotency_key
  ) values (
    v_first_observation.retailer_id, v_customer_id,
    v_first_observation.fitting_session_id, 'proposed',
    coalesce(p_proposed_measurements, '{}'::jsonb), p_idempotency_key
  ) returning id into v_candidate_id;

  -- Link observations to candidate.
  foreach v_observation_id in array p_observation_ids loop
    insert into public.fit_profile_candidate_observations (
      fit_profile_candidate_id, fitting_observation_id
    ) values (v_candidate_id, v_observation_id);
  end loop;

  return v_candidate_id;
end;
$$;
