-- VWS-001 / PHASE 4.6: the onboarding Style Portrait preview is a real
-- AI-rendered visualization before an Outfit exists. Reuse the existing
-- queue/result aggregate with a purpose discriminator; do not invent a
-- synthetic Outfit or expose provider output outside PAON Storage.

alter table public.wardrobe_visualization_jobs
  add column job_kind text not null default 'outfit' check (
    job_kind in ('outfit', 'style_portrait_preview')
  );

alter table public.wardrobe_visualization_jobs
  alter column outfit_id drop not null;

alter table public.wardrobe_visualization_jobs
  add constraint wardrobe_visualization_jobs_kind_outfit_chk check (
    (job_kind = 'outfit' and outfit_id is not null)
    or (job_kind = 'style_portrait_preview' and outfit_id is null)
  );

create unique index wardrobe_visualization_jobs_active_portrait_preview_uidx
  on public.wardrobe_visualization_jobs (style_portrait_id, input_hash)
  where job_kind = 'style_portrait_preview'
    and status in ('queued', 'generating');

create or replace function public.enforce_wardrobe_visualization_job_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_outfit_retailer_id uuid;
  v_outfit_customer_id uuid;
  v_portrait_retailer_id uuid;
  v_portrait_customer_id uuid;
  v_preset_retailer_id uuid;
begin
  if new.job_kind = 'outfit' then
    select o.retailer_id, o.customer_id
      into v_outfit_retailer_id, v_outfit_customer_id
    from public.outfits as o
    where o.id = new.outfit_id and o.deleted_at is null;
    if v_outfit_retailer_id is null
      or v_outfit_retailer_id <> new.retailer_id
      or v_outfit_customer_id <> new.customer_id then
      raise exception 'Visualization job outfit does not match the relationship';
    end if;
  end if;

  select p.retailer_id, p.customer_id
    into v_portrait_retailer_id, v_portrait_customer_id
  from public.style_portraits as p
  where p.id = new.style_portrait_id;
  if v_portrait_retailer_id is null
    or v_portrait_retailer_id <> new.retailer_id
    or v_portrait_customer_id <> new.customer_id then
    raise exception 'Visualization job style portrait does not match the relationship';
  end if;

  select v.retailer_id into v_preset_retailer_id
  from public.retailer_visual_presets as v
  where v.id = new.retailer_visual_preset_id;
  if v_preset_retailer_id is null or v_preset_retailer_id <> new.retailer_id then
    raise exception 'Visualization job preset does not belong to the retailer';
  end if;

  return new;
end;
$$;

-- Customer-only onboarding enqueue. Authorization precedes state disclosure,
-- and every mutable gate is re-derived in the insert transaction.
create or replace function public.enqueue_style_portrait_preview_job(
  p_retailer_id uuid,
  p_customer_id uuid,
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
  v_portrait_version integer;
  v_expected_tailoring jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.customers customer
    where customer.id = p_customer_id
      and customer.retailer_id = p_retailer_id
      and customer.user_id = auth.uid()
      and customer.deleted_at is null
  ) then
    raise exception 'Not authorized to enqueue this Style Portrait preview';
  end if;

  if public.retailer_module_access_state(
    p_retailer_id,
    'wardrobe_styling'
  ) is distinct from 'active' then
    raise exception 'Wardrobe styling is not active for this retailer';
  end if;

  if not exists (
    select 1 from public.style_portrait_consents consent
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
      and portrait.status = 'draft'
      and portrait.fit_archetype_concept_id is not null
      and exists (
        select 1 from public.style_portrait_references reference
        where reference.style_portrait_id = portrait.id
          and reference.retailer_id = p_retailer_id
          and reference.kind = 'face'
      )
      and exists (
        select 1 from public.style_portrait_references reference
        where reference.style_portrait_id = portrait.id
          and reference.retailer_id = p_retailer_id
          and reference.kind = 'full_body'
      )
  ) then
    raise exception 'A draft Style Portrait with face, full-body and fit references is required';
  end if;

  select portrait.version, concept.attributes -> 'tailoring'
    into v_portrait_version, v_expected_tailoring
  from public.style_portraits portrait
  join public.metadata_concepts concept
    on concept.id = portrait.fit_archetype_concept_id
  where portrait.id = p_style_portrait_id
    and concept.kind = 'fit'
    and concept.active
    and concept.attributes ->> 'isFitArchetype' = 'true'
    and (concept.retailer_id is null or concept.retailer_id = p_retailer_id);

  if v_expected_tailoring is null then
    raise exception 'Style Portrait fit preference is not a valid archetype';
  end if;

  if not exists (
    select 1 from public.retailer_visual_presets preset
    where preset.id = p_retailer_visual_preset_id
      and preset.retailer_id = p_retailer_id
  ) then
    raise exception 'Visual preset does not belong to this retailer';
  end if;

  -- The browser may call this RPC directly. Only the server-authored neutral
  -- preview contract may enter the AI queue; never trust arbitrary prompt or
  -- tailoring JSON supplied by the caller.
  if p_provider <> 'openai'
    or p_model <> 'gpt-image-2'
    or p_input_snapshot ->> 'kind' <> 'style_portrait_preview'
    or p_input_snapshot ->> 'stylePortraitId' <> p_style_portrait_id::text
    or p_input_snapshot ->> 'stylePortraitVersion' <> v_portrait_version::text
    or p_input_snapshot ->> 'retailerVisualPresetId'
      <> p_retailer_visual_preset_id::text
    or p_input_snapshot ->> 'providerName' <> p_provider
    or p_input_snapshot ->> 'model' <> p_model
    or p_input_snapshot -> 'tailoringAttributes' <> v_expected_tailoring
    or p_input_snapshot ->> 'writtenInstructions'
      <> 'Create a neutral studio Style Portrait in an understated plain outfit. Preserve identity and natural body proportions exactly.'
  then
    raise exception 'Style Portrait preview input does not match the authorized neutral render contract';
  end if;

  insert into public.wardrobe_visualization_jobs (
    retailer_id, customer_id, job_kind, outfit_id, style_portrait_id,
    retailer_visual_preset_id, provider, model, input_snapshot, input_hash
  ) values (
    p_retailer_id, p_customer_id, 'style_portrait_preview', null,
    p_style_portrait_id, p_retailer_visual_preset_id, p_provider, p_model,
    p_input_snapshot, p_input_hash
  )
  on conflict (style_portrait_id, input_hash)
    where job_kind = 'style_portrait_preview'
      and status in ('queued', 'generating')
  do nothing
  returning * into v_job;

  if v_job.id is null then
    select * into v_job
    from public.wardrobe_visualization_jobs
    where style_portrait_id = p_style_portrait_id
      and input_hash = p_input_hash
      and job_kind = 'style_portrait_preview'
      and status in ('queued', 'generating')
    order by created_at desc
    limit 1;
  end if;

  return v_job;
end;
$$;

revoke all on function public.enqueue_style_portrait_preview_job(
  uuid, uuid, uuid, uuid, text, text, jsonb, text
) from public;
grant execute on function public.enqueue_style_portrait_preview_job(
  uuid, uuid, uuid, uuid, text, text, jsonb, text
) to authenticated, service_role;

comment on function public.enqueue_style_portrait_preview_job(
  uuid, uuid, uuid, uuid, text, text, jsonb, text
) is
  'Customer-only enqueue for a neutral onboarding render, gated transactionally by House module access, explicit image consent, portrait references, fit selection and same-House preset.';

-- A ready onboarding job atomically unlocks approval. The image remains on
-- the job's private Storage coordinates and is signed only by repositories.
create or replace function public.complete_wardrobe_visualization_job(
  p_job_id uuid,
  p_status text,
  p_output_storage_bucket text default null,
  p_output_storage_path text default null,
  p_error_message text default null,
  p_actual_cost_cents integer default null
)
returns public.wardrobe_visualization_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.wardrobe_visualization_jobs%rowtype;
begin
  if p_status not in ('ready', 'failed') then
    raise exception 'Invalid completion status';
  end if;

  update public.wardrobe_visualization_jobs
  set status = p_status,
      output_storage_bucket = p_output_storage_bucket,
      output_storage_path = p_output_storage_path,
      error_message = p_error_message,
      actual_cost_cents = coalesce(p_actual_cost_cents, actual_cost_cents)
  where id = p_job_id and status = 'generating'
  returning * into v_job;

  if v_job.id is null then
    raise exception 'Job not found or not in progress';
  end if;

  if v_job.job_kind = 'style_portrait_preview' and p_status = 'ready' then
    update public.style_portraits
    set status = 'preview_generated'
    where id = v_job.style_portrait_id
      and retailer_id = v_job.retailer_id
      and customer_id = v_job.customer_id
      and status = 'draft';
    if not found then
      raise exception 'Style Portrait is no longer awaiting its preview';
    end if;
  end if;

  return v_job;
end;
$$;

revoke all on function public.complete_wardrobe_visualization_job(
  uuid, text, text, text, text, integer
) from public;
grant execute on function public.complete_wardrobe_visualization_job(
  uuid, text, text, text, text, integer
) to service_role;

comment on column public.wardrobe_visualization_jobs.job_kind is
  'Discriminates outfit renders from the pre-Outfit neutral Style Portrait onboarding preview within the same VWS queue aggregate.';
