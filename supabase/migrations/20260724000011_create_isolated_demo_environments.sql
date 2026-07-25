-- A stray, hand-created prospect_demo_environments table (bypassing the
-- real migration chain) survived a schema wipe that predates this push —
-- confirmed to hold no real data (nothing had gone live yet). Drop it so
-- this migration can create the real, versioned table with its actual
-- constraints and RLS policies.
drop table if exists public.prospect_demo_environments cascade;

create type public.prospect_demo_environment_status as enum (
  'draft', 'published', 'revoked', 'expired'
);

create table public.prospect_demo_environments (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null unique
    references public.commercial_prospects(id) on delete cascade,
  configuration_id uuid not null
    references public.prospect_demo_configurations(id) on delete restrict,
  configuration_version integer not null check (configuration_version > 0),
  public_token text not null unique check (length(public_token) >= 40),
  access_code_hash text,
  status public.prospect_demo_environment_status not null default 'draft',
  expires_at timestamptz not null,
  synthetic_data jsonb not null check (
    jsonb_typeof(synthetic_data) = 'object'
    and synthetic_data ?& array['personas', 'customers', 'products', 'appointments', 'alterations', 'orders', 'metrics']
  ),
  generated_at timestamptz not null default now(),
  published_at timestamptz,
  revoked_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_prospect_demo_environments_updated_at before update
  on public.prospect_demo_environments for each row execute function public.set_updated_at();

create table public.prospect_demo_engagement_events (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null
    references public.prospect_demo_environments(id) on delete cascade,
  event_name text not null check (event_name in ('opened', 'access_denied')),
  occurred_at timestamptz not null default now()
);

alter table public.prospect_demo_environments enable row level security;
alter table public.prospect_demo_engagement_events enable row level security;
create policy "platform staff manage prospect demo environments"
  on public.prospect_demo_environments for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "platform staff read demo engagement"
  on public.prospect_demo_engagement_events for select
  using (public.is_platform_staff());
grant select, insert, update, delete on public.prospect_demo_environments
  to authenticated, service_role;
grant select on public.prospect_demo_engagement_events to authenticated, service_role;

create or replace function public.generate_prospect_demo_environment(
  p_prospect_id uuid,
  p_public_token text,
  p_access_code text,
  p_expires_at timestamptz,
  p_synthetic_data jsonb
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

  insert into public.prospect_demo_environments (
    prospect_id, configuration_id, configuration_version, public_token,
    access_code_hash, status, expires_at, synthetic_data, created_by_user_id
  ) values (
    p_prospect_id, v_configuration.id, v_configuration.current_version,
    p_public_token, extensions.crypt(p_access_code, extensions.gen_salt('bf')),
    'draft', p_expires_at, p_synthetic_data, auth.uid()
  )
  on conflict (prospect_id) do update set
    configuration_id = excluded.configuration_id,
    configuration_version = excluded.configuration_version,
    public_token = excluded.public_token,
    access_code_hash = excluded.access_code_hash,
    status = 'draft',
    expires_at = excluded.expires_at,
    synthetic_data = excluded.synthetic_data,
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

create or replace function public.set_prospect_demo_publication(
  p_prospect_id uuid,
  p_publish boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_platform_staff() or auth.role() = 'service_role') then
    raise exception 'Platform staff access required';
  end if;
  update public.prospect_demo_environments set
    status = case when p_publish then 'published'::public.prospect_demo_environment_status
      else 'revoked'::public.prospect_demo_environment_status end,
    published_at = case when p_publish then now() else published_at end,
    revoked_at = case when p_publish then null else now() end
  where prospect_id = p_prospect_id and expires_at > now();
  if not found then raise exception 'Current demo environment not found'; end if;
  update public.prospect_demo_configurations set
    status = case when p_publish then 'published'::public.demo_configuration_status
      else 'review_ready'::public.demo_configuration_status end
  where prospect_id = p_prospect_id;
  update public.commercial_prospects set
    stage = case when p_publish then 'demo_ready'::public.commercial_prospect_stage
      else 'demo_preparation'::public.commercial_prospect_stage end
  where id = p_prospect_id;
end;
$$;

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
    'configuration', jsonb_build_object(
      'theme', c.theme,
      'marketingHeadline', c.marketing_headline,
      'personalizedIntroduction', c.personalized_introduction,
      'locations', c.locations,
      'productMix', to_jsonb(c.product_mix)
    ),
    'syntheticData', v_environment.synthetic_data
  ) into v_result
  from public.commercial_prospects p
  join public.prospect_demo_configurations c on c.prospect_id = p.id
  where p.id = v_environment.prospect_id;
  insert into public.prospect_demo_engagement_events(environment_id, event_name)
    values (v_environment.id, 'opened');
  return v_result;
end;
$$;

revoke all on function public.generate_prospect_demo_environment(
  uuid, text, text, timestamptz, jsonb
) from public;
revoke all on function public.set_prospect_demo_publication(uuid, boolean) from public;
revoke all on function public.open_prospect_demo(text, text) from public;
grant execute on function public.generate_prospect_demo_environment(
  uuid, text, text, timestamptz, jsonb
) to authenticated, service_role;
grant execute on function public.set_prospect_demo_publication(uuid, boolean)
  to authenticated, service_role;
grant execute on function public.open_prospect_demo(text, text)
  to anon, authenticated, service_role;
