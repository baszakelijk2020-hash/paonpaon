-- Demo Studio step 3: a successful private-demo open hands back the live
-- tenant slug so /demo/[token] can route into /r/{slug} instead of the
-- synthetic blob. Environments that never generated a retailer fail closed.

create or replace function public.open_prospect_demo(
  p_public_token text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_environment public.prospect_demo_environments%rowtype;
  v_result jsonb;
begin
  select * into v_environment from public.prospect_demo_environments
  where public_token = p_public_token;
  if not found
    or v_environment.status <> 'published'
    or v_environment.expires_at <= now()
    or v_environment.retailer_slug is null
  then return null; end if;
  if v_environment.access_code_hash is not null
    and v_environment.access_code_hash <> extensions.crypt(
      coalesce(p_access_code, ''), v_environment.access_code_hash
    )
  then
    insert into public.prospect_demo_engagement_events(environment_id, event_name)
      values (v_environment.id, 'access_denied');
    return null;
  end if;
  select jsonb_build_object(
    'environmentId', v_environment.id,
    'companyName', p.company_name,
    'expiresAt', v_environment.expires_at,
    'retailerSlug', v_environment.retailer_slug,
    'configuration', jsonb_build_object(
      'theme', c.theme,
      'marketingHeadline', c.marketing_headline,
      'personalizedIntroduction', c.personalized_introduction,
      'locations', c.locations,
      'productMix', to_jsonb(c.product_mix)
    )
  ) into v_result
  from public.commercial_prospects p
  join public.prospect_demo_configurations c on c.prospect_id = p.id
  where p.id = v_environment.prospect_id;
  insert into public.prospect_demo_engagement_events(environment_id, event_name)
    values (v_environment.id, 'opened');
  return v_result;
end;
$$;
