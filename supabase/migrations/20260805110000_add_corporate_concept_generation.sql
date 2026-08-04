-- PHASE 18.10 (BD-110): AI-assisted corporate tender concept/moodboard
-- images. The generation attempt itself is recorded through the
-- existing `ai_generations` audit trail (a new `corporate_concept`
-- kind, not a second log) — this migration only adds the persisted,
-- approval-gated asset a generation attempt may produce.
--
-- An asset starts `pending_approval` and can be decided exactly once
-- (`corporate_concept_assets_decided_fields` mirrors the tender
-- approval discipline from 18.2: the decision fields and the status are
-- kept consistent by a check constraint, not application code alone).
-- `resolve_corporate_tender` (18.3) is updated below to surface only
-- `approved` rows — a pending or rejected image can never reach the
-- public page, enforced here in SQL.

alter type public.ai_generation_kind add value if not exists 'corporate_concept';

create table if not exists public.corporate_concept_assets (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  tender_version_id uuid not null
    references public.corporate_tender_versions (id) on delete cascade,
  ai_generation_id uuid not null
    references public.ai_generations (id) on delete restrict,
  image_url text not null check (char_length(image_url) between 1 and 2000),
  prompt text not null check (char_length(btrim(prompt)) between 1 and 2000),
  status text not null default 'pending_approval' check (
    status in ('pending_approval', 'approved', 'rejected')
  ),
  approved_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint corporate_concept_assets_decided_fields check (
    (status = 'approved') = (approved_by_staff_id is not null and approved_at is not null)
  )
);

create index if not exists corporate_concept_assets_tender_version_idx
  on public.corporate_concept_assets (tender_version_id, created_at desc);

alter table public.corporate_concept_assets enable row level security;
revoke all on table public.corporate_concept_assets from public, anon;
grant select, insert on table public.corporate_concept_assets
  to authenticated, service_role;
grant update on table public.corporate_concept_assets to authenticated, service_role;

create policy corporate_concept_assets_retailer_select
  on public.corporate_concept_assets for select to authenticated using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

create policy corporate_concept_assets_staff_insert
  on public.corporate_concept_assets for insert to authenticated with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in
      ('owner', 'manager', 'admin', 'sales_associate')
  );

-- Deciding (approve/reject) is the only update this table ever needs —
-- the image/prompt themselves are never edited in place.
create policy corporate_concept_assets_staff_decide
  on public.corporate_concept_assets for update to authenticated using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in
      ('owner', 'manager', 'admin', 'sales_associate')
  ) with check (retailer_id = public.current_retailer_id());

comment on table public.corporate_concept_assets is
  'PHASE 18.10 / BD-110. AI-generated tender concept images, attributed '
  'to a real ai_generations row, approval-gated exactly once before '
  'resolve_corporate_tender (18.3) will ever surface one.';

-- Extend the public tender reveal with any APPROVED concept images for
-- the resolved version only.
create or replace function public.resolve_corporate_tender(
  p_share_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tender public.corporate_tenders%rowtype;
  v_opportunity public.corporate_opportunities%rowtype;
  v_retailer public.retailers%rowtype;
  v_version public.corporate_tender_versions%rowtype;
  v_image_urls jsonb;
begin
  select * into v_tender
    from public.corporate_tenders
    where share_token = p_share_token;
  if not found then
    raise exception 'This tender link is no longer valid';
  end if;

  select * into v_opportunity
    from public.corporate_opportunities
    where id = v_tender.opportunity_id and deleted_at is null;
  if not found then
    raise exception 'This tender link is no longer valid';
  end if;

  select * into v_retailer
    from public.retailers
    where id = v_tender.retailer_id and deleted_at is null;
  if not found or v_retailer.status <> 'active' then
    raise exception 'This tender link is no longer valid';
  end if;

  select v.* into v_version
    from public.corporate_tender_versions v
    join public.corporate_tender_approvals a on a.tender_version_id = v.id
    where v.tender_id = v_tender.id
    order by v.version desc
    limit 1;

  if not found then
    return jsonb_build_object(
      'retailerDisplayName', v_retailer.display_name,
      'companyName', v_opportunity.company_name,
      'tenderTitle', v_tender.title,
      'status', 'not_published'
    );
  end if;

  select coalesce(jsonb_agg(ca.image_url order by ca.approved_at), '[]'::jsonb)
    into v_image_urls
    from public.corporate_concept_assets ca
    where ca.tender_version_id = v_version.id and ca.status = 'approved';

  return jsonb_build_object(
    'retailerDisplayName', v_retailer.display_name,
    'companyName', v_opportunity.company_name,
    'tenderTitle', v_tender.title,
    'status', 'published',
    'version', v_version.version,
    'summary', v_version.summary,
    'garmentConcepts', to_jsonb(v_version.garment_concepts),
    'pricingNote', v_version.pricing_note,
    'conceptImageUrls', v_image_urls
  );
end;
$$;
