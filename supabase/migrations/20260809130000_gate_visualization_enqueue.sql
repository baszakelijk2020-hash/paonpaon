-- Close the older Virtual Wardrobe Studio branch's authorization gap after
-- reconciling it with the R0.3 module kernel and persisted portrait consent.
-- Cancellation remains separately available so a customer can stop queued
-- work after module suspension or consent withdrawal.

create or replace function public.enqueue_wardrobe_visualization_job(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_outfit_id uuid,
  p_style_portrait_id uuid,
  p_retailer_visual_preset_id uuid,
  p_provider text,
  p_model text,
  p_input_snapshot jsonb,
  p_input_hash text
)
returns public.wardrobe_visualization_jobs
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

  select exists (
    select 1 from public.customers c
    where c.id = p_customer_id
      and c.retailer_id = p_retailer_id
      and c.user_id = auth.uid()
      and c.deleted_at is null
  ) into v_is_owning_customer;

  select exists (
    select 1 from public.customers c
    where c.id = p_customer_id
      and c.retailer_id = p_retailer_id
      and c.deleted_at is null
  ) and public.current_retailer_id() = p_retailer_id
    and public.current_retailer_role() in (
      'sales_associate', 'manager', 'admin', 'owner'
    ) into v_is_authorized_advisor;

  if not v_is_owning_customer and not v_is_authorized_advisor then
    raise exception 'Not authorized to enqueue this visualization job';
  end if;

  -- Authorize before disclosing any module, consent or portrait state for the
  -- requested relationship. These checks remain in the same transaction as
  -- the insert so a stale browser render cannot bypass a later withdrawal.
  if public.retailer_module_access_state(
    p_retailer_id,
    'wardrobe_styling'
  ) is distinct from 'active' then
    raise exception 'Wardrobe styling is not active for this retailer';
  end if;

  if not exists (
    select 1
    from public.style_portrait_consents consent
    where consent.retailer_id = p_retailer_id
      and consent.customer_id = p_customer_id
      and consent.status = 'granted'
      and consent.disclosures_acknowledged
  ) then
    raise exception 'Image-generation consent is not active';
  end if;

  if not exists (
    select 1
    from public.style_portraits portrait
    where portrait.id = p_style_portrait_id
      and portrait.retailer_id = p_retailer_id
      and portrait.customer_id = p_customer_id
      and portrait.status = 'approved'
  ) then
    raise exception 'An approved Style Portrait is required';
  end if;

  insert into public.wardrobe_visualization_jobs (
    retailer_id, customer_id, outfit_id, style_portrait_id,
    retailer_visual_preset_id, provider, model, input_snapshot, input_hash
  ) values (
    p_retailer_id, p_customer_id, p_outfit_id, p_style_portrait_id,
    p_retailer_visual_preset_id, p_provider, p_model, p_input_snapshot,
    p_input_hash
  )
  on conflict (outfit_id, input_hash) where status in ('queued', 'generating')
  do nothing
  returning * into v_job;

  if v_job.id is null then
    select * into v_job
    from public.wardrobe_visualization_jobs
    where outfit_id = p_outfit_id
      and input_hash = p_input_hash
      and status in ('queued', 'generating')
    order by created_at desc
    limit 1;
  end if;

  return v_job;
end;
$$;

revoke all on function public.enqueue_wardrobe_visualization_job(
  uuid, uuid, uuid, uuid, uuid, text, text, jsonb, text
) from public;
grant execute on function public.enqueue_wardrobe_visualization_job(
  uuid, uuid, uuid, uuid, uuid, text, text, jsonb, text
) to authenticated, service_role;

comment on function public.enqueue_wardrobe_visualization_job(
  uuid, uuid, uuid, uuid, uuid, text, text, jsonb, text
) is
  'Enqueues only for an active wardrobe module, explicit persisted image-generation consent, an approved same-House portrait, and an authorized customer/advisor.';
