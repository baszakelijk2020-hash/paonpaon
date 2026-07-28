-- Public preview for private-demo link unfurls and gate branding.
-- Returns only published, non-expired demos — no access code required,
-- no engagement event, no storefront unlock.

create or replace function public.preview_prospect_demo(p_public_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_environment public.prospect_demo_environments%rowtype;
  v_result jsonb;
begin
  if p_public_token is null or length(trim(p_public_token)) < 8 then
    return null;
  end if;

  select * into v_environment
  from public.prospect_demo_environments
  where public_token = p_public_token;

  if not found
    or v_environment.status <> 'published'
    or v_environment.expires_at <= now()
  then
    return null;
  end if;

  select jsonb_build_object(
    'companyName', p.company_name,
    'marketingHeadline', c.marketing_headline,
    'logoUrl', c.theme ->> 'logoUrl',
    'heroImageUrl', c.theme ->> 'heroImageUrl',
    'accentColor', c.theme ->> 'accentColor',
    'surfaceColor', c.theme ->> 'surfaceColor',
    'inkColor', c.theme ->> 'inkColor'
  ) into v_result
  from public.commercial_prospects p
  join public.prospect_demo_configurations c
    on c.id = v_environment.configuration_id
  where p.id = v_environment.prospect_id;

  return v_result;
end;
$$;

revoke all on function public.preview_prospect_demo(text) from public;
grant execute on function public.preview_prospect_demo(text)
  to anon, authenticated, service_role;
