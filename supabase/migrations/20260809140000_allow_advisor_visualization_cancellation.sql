-- PHASE 4.9 lets an authorized advisor manage the visual-roadmap queue.
-- Keep cancellation available after module suspension or consent withdrawal,
-- but re-derive the owning customer/House and advisor role server-side.

create or replace function public.cancel_wardrobe_visualization_job(
  p_job_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.wardrobe_visualization_jobs%rowtype;
  v_is_owning_customer boolean;
  v_is_authorized_advisor boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_job
  from public.wardrobe_visualization_jobs
  where id = p_job_id;

  if not found then
    raise exception 'Job not found';
  end if;

  select exists (
    select 1
    from public.customers customer
    where customer.id = v_job.customer_id
      and customer.retailer_id = v_job.retailer_id
      and customer.user_id = auth.uid()
      and customer.deleted_at is null
  ) into v_is_owning_customer;

  select exists (
    select 1
    from public.customers customer
    where customer.id = v_job.customer_id
      and customer.retailer_id = v_job.retailer_id
      and customer.deleted_at is null
  )
    and public.current_retailer_id() = v_job.retailer_id
    and public.current_retailer_role() in (
      'sales_associate', 'manager', 'admin', 'owner'
    ) into v_is_authorized_advisor;

  if not v_is_owning_customer and not v_is_authorized_advisor then
    raise exception 'Not authorized to cancel this job';
  end if;

  if v_job.status <> 'queued' then
    raise exception 'Only a queued job can be cancelled';
  end if;

  update public.wardrobe_visualization_jobs
  set status = 'cancelled'
  where id = p_job_id;
end;
$$;

revoke all on function public.cancel_wardrobe_visualization_job(uuid)
  from public;
grant execute on function public.cancel_wardrobe_visualization_job(uuid)
  to authenticated, service_role;

comment on function public.cancel_wardrobe_visualization_job(uuid) is
  'Cancels a queued visualization for the owning customer or an authorized same-House advisor, including after consent withdrawal or module suspension.';
