-- Demo Studio step 1 (PHASE.md workstream 2): a generated prospect demo
-- environment owns a real retailer tenant, not only a synthetic_data blob.
-- synthetic_data stays for the current Studio/public preview surfaces until
-- step 3 reworks /demo/[token] to route into the live storefront and portal.

alter table public.prospect_demo_environments
  add column retailer_id uuid references public.retailers (id) on delete set null,
  add column retailer_slug text;

create unique index prospect_demo_environments_retailer_id_uidx
  on public.prospect_demo_environments (retailer_id)
  where retailer_id is not null;

-- New arity (adds retailer linkage). Drop the previous 5-arg form first —
-- CREATE OR REPLACE only replaces an exact signature match.
drop function if exists public.generate_prospect_demo_environment(
  uuid, text, text, timestamptz, jsonb
);

create or replace function public.generate_prospect_demo_environment(
  p_prospect_id uuid,
  p_public_token text,
  p_access_code text,
  p_expires_at timestamptz,
  p_synthetic_data jsonb,
  p_retailer_id uuid default null,
  p_retailer_slug text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_configuration public.prospect_demo_configurations%rowtype;
  v_id uuid;
begin
  if not (public.is_platform_staff() or auth.role() = 'service_role') then
    raise exception 'Platform staff access required';
  end if;
  select * into v_configuration from public.prospect_demo_configurations
    where prospect_id = p_prospect_id for update;
  if not found or v_configuration.current_version < 1 then
    raise exception 'A saved demo configuration is required';
  end if;
  if length(p_public_token) < 40
    or p_expires_at <= now()
    or length(coalesce(p_access_code, '')) not between 6 and 80
    or jsonb_typeof(p_synthetic_data) <> 'object'
    or not (p_synthetic_data ?& array[
      'personas', 'customers', 'products', 'appointments',
      'alterations', 'orders', 'metrics'
    ])
  then raise exception 'Invalid demo environment'; end if;
  if p_retailer_id is not null and not exists (
    select 1 from public.retailers r where r.id = p_retailer_id and r.deleted_at is null
  ) then
    raise exception 'Demo retailer not found';
  end if;

  insert into public.prospect_demo_environments (
    prospect_id, configuration_id, configuration_version, public_token,
    access_code_hash, status, expires_at, synthetic_data,
    retailer_id, retailer_slug, created_by_user_id
  ) values (
    p_prospect_id, v_configuration.id, v_configuration.current_version,
    p_public_token, extensions.crypt(p_access_code, extensions.gen_salt('bf')),
    'draft', p_expires_at, p_synthetic_data,
    p_retailer_id, nullif(trim(coalesce(p_retailer_slug, '')), ''),
    auth.uid()
  )
  on conflict (prospect_id) do update set
    configuration_id = excluded.configuration_id,
    configuration_version = excluded.configuration_version,
    public_token = excluded.public_token,
    access_code_hash = excluded.access_code_hash,
    status = 'draft',
    expires_at = excluded.expires_at,
    synthetic_data = excluded.synthetic_data,
    retailer_id = coalesce(excluded.retailer_id, prospect_demo_environments.retailer_id),
    retailer_slug = coalesce(excluded.retailer_slug, prospect_demo_environments.retailer_slug),
    generated_at = now(),
    published_at = null,
    revoked_at = null,
    created_by_user_id = excluded.created_by_user_id
  returning id into v_id;
  update public.commercial_prospects set stage = 'demo_preparation'
    where id = p_prospect_id;
  return v_id;
end;
$$;

revoke all on function public.generate_prospect_demo_environment(
  uuid, text, text, timestamptz, jsonb, uuid, text
) from public;
grant execute on function public.generate_prospect_demo_environment(
  uuid, text, text, timestamptz, jsonb, uuid, text
) to authenticated, service_role;
