-- PHASE 18.3 (BD-103): the public tender page. Extends the same
-- anonymous-opaque-token pattern `resolve_gift_invitation` (PHASE 15.x)
-- already established, rather than inventing a second public-page
-- mechanism — see docs/PHASE.md Stage 18's audit note.
--
-- `resolve_corporate_tender` exposes the tender's LATEST APPROVED
-- version only. A tender with zero approved versions resolves to a
-- `not_published` status carrying no content at all — never a draft
-- summary, never draft garment concepts, never a pricing note nobody
-- has signed off on. This is the acceptance criterion enforced in SQL,
-- not just in the calling page's rendering choices.

alter table public.corporate_tenders
  add column if not exists share_token uuid not null default gen_random_uuid() unique;

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

  -- Latest version that actually has an approval row — never the latest
  -- version outright, which may be an unapproved draft.
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

  return jsonb_build_object(
    'retailerDisplayName', v_retailer.display_name,
    'companyName', v_opportunity.company_name,
    'tenderTitle', v_tender.title,
    'status', 'published',
    'version', v_version.version,
    'summary', v_version.summary,
    'garmentConcepts', to_jsonb(v_version.garment_concepts),
    'pricingNote', v_version.pricing_note
  );
end;
$$;

revoke all on function public.resolve_corporate_tender(uuid) from public;
grant execute on function public.resolve_corporate_tender(uuid)
  to anon, authenticated, service_role;

comment on function public.resolve_corporate_tender(uuid) is
  'PHASE 18.3 / BD-103. Anonymous, opaque-token reveal of a tender''s '
  'latest APPROVED version only — a tender with no approved version '
  'resolves to not_published with zero draft content, enforced here in '
  'SQL, not left to the calling page to withhold.';
