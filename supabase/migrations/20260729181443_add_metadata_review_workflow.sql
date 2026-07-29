-- Stage 1.3: assignment proposals enter pending and terminal review decisions
-- go through one actor-derived, idempotent transition boundary.

drop policy "authorized staff can insert tenant metadata assignments"
  on public.entity_metadata_assignments;
drop policy "authorized staff can update tenant metadata assignments"
  on public.entity_metadata_assignments;
drop policy "authorized staff can delete tenant metadata assignments"
  on public.entity_metadata_assignments;

create policy "authorized staff can propose tenant metadata assignments"
  on public.entity_metadata_assignments for insert to authenticated
  with check (
    review_status = 'pending'
    and reviewed_by_staff_id is null
    and reviewed_at is null
    and (
      (select public.is_platform_staff())
      or (
        retailer_id = (select public.current_retailer_id())
        and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
      )
    )
  );

-- The Data API may propose but cannot rewrite, hard-delete, or assert review
-- actor/time directly. The definer RPC below owns terminal transitions.
revoke update, delete on table public.entity_metadata_assignments
  from authenticated;

create or replace function public.review_metadata_assignment(
  p_assignment_id uuid,
  p_review_status public.metadata_review_status
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.entity_metadata_assignments%rowtype;
  v_staff_id uuid;
begin
  if p_review_status not in ('accepted', 'rejected') then
    raise exception 'Review decision must be accepted or rejected';
  end if;

  if public.current_retailer_role() not in ('manager', 'admin', 'owner') then
    raise exception 'Not authorized to review metadata assignments';
  end if;

  v_staff_id := public.current_staff_id();
  if v_staff_id is null then
    raise exception 'An accepted retailer staff identity is required';
  end if;

  select assignment.* into v_assignment
  from public.entity_metadata_assignments as assignment
  where assignment.id = p_assignment_id
    and assignment.deleted_at is null
  for update;

  if not found
    or v_assignment.retailer_id <> public.current_retailer_id() then
    raise exception 'Metadata assignment is unavailable';
  end if;

  if v_assignment.review_status = p_review_status then
    return v_assignment.id;
  end if;

  update public.entity_metadata_assignments
  set
    review_status = p_review_status,
    reviewed_by_staff_id = v_staff_id,
    reviewed_at = clock_timestamp()
  where id = v_assignment.id;

  return v_assignment.id;
end;
$$;

revoke all on function public.review_metadata_assignment(
  uuid,
  public.metadata_review_status
) from public;
grant execute on function public.review_metadata_assignment(
  uuid,
  public.metadata_review_status
) to authenticated;

comment on function public.review_metadata_assignment(
  uuid,
  public.metadata_review_status
) is
  'Atomically accepts/rejects a same-tenant metadata proposal, deriving the reviewer and recording one audit event per changed decision.';
