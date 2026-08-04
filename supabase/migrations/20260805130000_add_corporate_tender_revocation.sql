-- PHASE 18.3 (BD-103) named gap closure: revocation. 18.3's own status
-- named this precisely: "share_token is permanent with no revoke action
-- anywhere, so a link, once shared, is shareable forever." This adds a
-- one-way `revoked_at` and updates `resolve_corporate_tender` to refuse
-- ANY content — approved or not — once a tender is revoked, enforced in
-- the function itself, not left to the calling page.

alter table public.corporate_tenders
  add column if not exists revoked_at timestamptz;

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

  if v_tender.revoked_at is not null then
    return jsonb_build_object(
      'retailerDisplayName', v_retailer.display_name,
      'companyName', v_opportunity.company_name,
      'tenderTitle', v_tender.title,
      'status', 'revoked'
    );
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
