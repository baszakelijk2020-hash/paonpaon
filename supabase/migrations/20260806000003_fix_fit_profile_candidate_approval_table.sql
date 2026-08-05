-- approve_fit_profile_candidate (20260806000000) wrote its approved
-- measurements into public.customer_fit_profile_entries — a table that
-- 20260719000101 renamed to legacy_customer_fit_profile_entries over two
-- weeks earlier, with an explicit founder clarification that PAON does not
-- own a generic customer-measurement ledger, only garment-tied
-- fitting_observations. Every real call to approve_fit_profile_candidate
-- therefore failed with "relation does not exist" (caught wiring the first
-- real caller, not by the original migration's pgTAP coverage, which never
-- exercised the actual insert path). Fixed by dropping the write: the
-- fitting_observations rows the candidate was proposed from already are
-- the durable record under the garment-first model: approval only needs to
-- record the advisor's decision (fit_profile_candidate_actions) and
-- advance the candidate's own status, which the function still does.
create or replace function public.approve_fit_profile_candidate(
  p_candidate_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate public.fit_profile_candidates%rowtype;
  v_staff_id uuid;
begin
  if not public.is_alterations_advisor() then
    raise exception 'Not authorized to review fit profile candidates';
  end if;

  select * into v_candidate from public.fit_profile_candidates
    where id = p_candidate_id and retailer_id = public.current_retailer_id();
  if not found then
    raise exception 'Candidate not found';
  end if;
  if v_candidate.status <> 'proposed' then
    raise exception 'Candidate is not awaiting review';
  end if;

  v_staff_id := public.current_staff_id();

  -- Record the approval action.
  insert into public.fit_profile_candidate_actions (
    fit_profile_candidate_id, action_by_staff_id, action, note
  ) values (
    p_candidate_id, v_staff_id, 'approved', p_note
  );

  -- Advance candidate to advisor_approved. The contributing
  -- fitting_observations rows (public.fit_profile_candidate_observations)
  -- already are the durable record under the garment-first model; there is
  -- no separate customer-measurement table to write.
  update public.fit_profile_candidates
    set status = 'advisor_approved'
    where id = p_candidate_id;
end;
$$;
