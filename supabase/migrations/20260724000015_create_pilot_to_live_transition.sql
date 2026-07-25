-- Pilot to Live Onboarding Transition
-- Converts a prospect in the 'pilot' stage to an active retailer

create or replace function public.convert_pilot_to_live_retailer(
  p_prospect_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prospect public.commercial_prospects%rowtype;
  v_retailer_id uuid;
  v_configuration public.prospect_demo_configurations%rowtype;
begin
  -- Check that the prospect exists and is in the pilot stage
  select * into v_prospect from public.commercial_prospects
    where id = p_prospect_id and stage = 'pilot' and deleted_at is null;

  if not found then
    raise exception 'Prospect not found or not in pilot stage';
  end if;

  -- Create a retailer record from the prospect
  insert into public.retailers (
    legal_name,
    display_name,
    slug,
    status,
    tier,
    primary_domain,
    billing_address,
    default_currency,
    default_locale,
    brand_theme
  ) values (
    v_prospect.company_name,
    v_prospect.company_name, -- display_name same as company_name for now
    lower(regexp_replace(v_prospect.company_name, '[^a-z0-9]+', '-', 'g')), -- slug
    'active',
    'boutique', -- default tier, can be updated later
    null, -- primary_domain to be set by retailer during onboarding
    '{}'::jsonb, -- billing_address
    'EUR', -- default_currency
    'en-US', -- default_locale
    '{}'::jsonb -- brand_theme to be set later
  )
  returning id into v_retailer_id;

  -- Optionally, copy the demo configuration to the retailer's brand theme or settings
  -- For now, we'll just note that the retailer can configure their theme later
  -- We could also copy the product mix, locations, etc. to the retailer's initial setup
  -- but that would require additional tables and is beyond the scope of this transition.

  -- Update the prospect stage to 'converted'
  update public.commercial_prospects
    set stage = 'converted'
    where id = p_prospect_id;

  return v_retailer_id;
end;
$$;

-- Grant execute permissions
grant execute on function public.convert_pilot_to_live_retailer(uuid) to authenticated, service_role;

-- Add a comment
comment on function public.convert_pilot_to_live_retailer(uuid) is
  'Converts a prospect in the pilot stage to an active retailer. Returns the new retailer ID.';