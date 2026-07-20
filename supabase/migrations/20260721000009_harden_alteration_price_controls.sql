-- Hardening pass on the existing proposal/approval price-change flow
-- (docs/DECISIONS.md, garment-first alterations ADR block) — two real
-- gaps identified in an audit: unlimited resubmission after rejection,
-- and no dual-control on large increases (any single manager/admin/
-- owner could approve an unbounded increase, which is exactly the
-- single-point-of-collusion a "watertight" control needs to close).
-- Everything else audited (immutable original quote, mandatory
-- explanation/evidence, append-only history, amount ceiling,
-- workshop-manager-only proposing, management-only deciding) was
-- already real and is left unchanged.

create or replace function public.propose_alteration_price_change(
  p_alteration_id uuid,
  p_task_id uuid,
  p_proposed_amount_minor_units integer,
  p_explanation text,
  p_evidence_attachment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.alteration_work_orders%rowtype;
  v_original integer;
  v_id uuid;
  v_staff_id uuid := public.current_staff_id();
  v_rejected_count integer;
begin
  select * into v_order from public.alteration_work_orders where id = p_alteration_id and deleted_at is null;
  if v_order.id is null or not public.can_access_alteration_work_order(p_alteration_id) then raise exception 'Work order not found'; end if;
  if public.current_retailer_role() <> 'workshop_manager' and auth.role() <> 'service_role' then
    raise exception 'Only an assigned workshop manager may propose price changes';
  end if;
  if v_order.status not in ('assigned','in_progress') then
    raise exception 'Price changes may only be proposed while assigned work is active';
  end if;
  if length(trim(p_explanation)) < 10 then raise exception 'A substantive explanation is required'; end if;
  if p_proposed_amount_minor_units not between 0 and 100000000 then
    raise exception 'Price must be between zero and 1,000,000 major currency units';
  end if;
  if p_evidence_attachment_id is not null and not exists (
    select 1 from public.alteration_attachments a
    where a.id = p_evidence_attachment_id
      and a.retailer_id = v_order.retailer_id
      and (
        a.alteration_id = p_alteration_id
        or a.physical_garment_id = v_order.physical_garment_id
        or exists (
          select 1 from public.alteration_tasks t
          where t.id = a.task_id and t.alteration_id = p_alteration_id
        )
      )
  ) then raise exception 'Evidence attachment does not belong to this work order'; end if;
  if p_task_id is not null then
    select original_quote_amount_minor_units into v_original from public.alteration_tasks where id = p_task_id and alteration_id = p_alteration_id;
    if v_original is null then raise exception 'Task not found on work order'; end if;
  else
    v_original := v_order.original_quote_amount_minor_units;
  end if;

  -- Fraud-prevention: cap resubmission after rejection. Two rejected
  -- proposals on the same target means the workshop has already had
  -- two chances to justify a price with evidence — a third attempt
  -- needs a human conversation, not another automated proposal.
  select count(*) into v_rejected_count
    from public.price_change_proposals
    where alteration_id = p_alteration_id
      and coalesce(task_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(p_task_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and status = 'rejected'
      and deleted_at is null;
  if v_rejected_count >= 2 then
    raise exception 'Two price proposals for this item have already been rejected — contact the retailer directly instead of resubmitting';
  end if;

  insert into public.price_change_proposals (
    alteration_id, task_id, retailer_id, original_amount_minor_units,
    proposed_amount_minor_units, currency, explanation, proposed_by_staff_id,
    evidence_attachment_id
  ) values (
    p_alteration_id, p_task_id, v_order.retailer_id, v_original,
    p_proposed_amount_minor_units, v_order.original_quote_currency,
    trim(p_explanation), v_staff_id, p_evidence_attachment_id
  ) returning id into v_id;
  insert into public.alteration_pricing_history (
    alteration_id, task_id, retailer_id, event_type, amount_minor_units,
    currency, reason, actor_staff_id
  ) values (
    p_alteration_id, p_task_id, v_order.retailer_id, 'proposal',
    p_proposed_amount_minor_units, v_order.original_quote_currency,
    trim(p_explanation), v_staff_id
  );
  return v_id;
end;
$$;

create or replace function public.decide_alteration_price_change(
  p_proposal_id uuid,
  p_decision public.price_change_proposal_status,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.price_change_proposals%rowtype;
  v_total integer;
  v_staff_id uuid := public.current_staff_id();
  v_increase_ratio numeric;
begin
  select * into v_proposal from public.price_change_proposals where id = p_proposal_id and deleted_at is null for update;
  if v_proposal.id is null or v_proposal.status <> 'pending' then raise exception 'Pending proposal not found'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
  if length(trim(p_reason)) < 3 then raise exception 'Decision reason is required'; end if;
  if not exists (
    select 1 from public.alteration_work_orders w
    where w.id = v_proposal.alteration_id
      and w.status in ('assigned','in_progress')
      and w.deleted_at is null
  ) then raise exception 'Price proposals may only be decided while assigned work is active'; end if;
  if auth.role() <> 'service_role' and (
    public.is_platform_staff()
    or v_proposal.retailer_id <> public.current_retailer_id()
    or not public.is_alterations_management()
  )
  then raise exception 'Retailer management approval is required'; end if;

  -- Fraud-prevention: dual control on large increases. A proposal
  -- more than 50% above the original quote (and at least 5000 minor
  -- units, so a trivial small-ticket item never trips this) can only
  -- be approved by the retailer owner — a manager/admin colluding
  -- with a workshop can no longer unilaterally approve an inflated
  -- invoice on their own.
  if p_decision = 'approved' and v_proposal.original_amount_minor_units > 0 then
    v_increase_ratio := v_proposal.proposed_amount_minor_units::numeric / v_proposal.original_amount_minor_units::numeric;
    if v_increase_ratio > 1.5
      and (v_proposal.proposed_amount_minor_units - v_proposal.original_amount_minor_units) >= 5000
      and auth.role() <> 'service_role'
      and public.current_retailer_role() <> 'owner'
    then
      raise exception 'Increases of more than 50%% over the original quote require owner approval';
    end if;
  end if;

  update public.price_change_proposals
  set status = p_decision, decided_by_staff_id = v_staff_id,
      decided_at = now(), decision_reason = trim(p_reason)
  where id = p_proposal_id;

  if p_decision = 'approved' then
    if v_proposal.task_id is not null then
      update public.alteration_tasks
      set agreed_price_amount_minor_units = v_proposal.proposed_amount_minor_units,
          agreed_price_currency = v_proposal.currency
      where id = v_proposal.task_id;
      select sum(coalesce(agreed_price_amount_minor_units, original_quote_amount_minor_units))
        into v_total from public.alteration_tasks
        where alteration_id = v_proposal.alteration_id and classification = 'work_now' and deleted_at is null;
    else
      v_total := v_proposal.proposed_amount_minor_units;
    end if;
    update public.alteration_work_orders
    set agreed_total_amount_minor_units = v_total,
        agreed_total_currency = v_proposal.currency
    where id = v_proposal.alteration_id;
  end if;

  insert into public.alteration_pricing_history (
    alteration_id, task_id, retailer_id, event_type, amount_minor_units,
    currency, reason, actor_staff_id
  ) values (
    v_proposal.alteration_id, v_proposal.task_id, v_proposal.retailer_id,
    case when p_decision = 'approved' then 'approval' else 'rejection' end,
    v_proposal.proposed_amount_minor_units, v_proposal.currency,
    trim(p_reason), v_staff_id
  );
end;
$$;
