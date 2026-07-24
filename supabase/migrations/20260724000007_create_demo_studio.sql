create type public.commercial_prospect_stage as enum (
  'researched', 'qualified', 'demo_preparation', 'demo_ready', 'demo_sent',
  'consultation', 'proposal', 'pilot', 'converted', 'lost'
);

create table public.commercial_prospects (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (length(trim(company_name)) between 2 and 160),
  website_url text check (website_url is null or website_url ~ '^https://'),
  primary_contact_name text not null
    check (length(trim(primary_contact_name)) between 2 and 160),
  primary_contact_email text not null
    check (primary_contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  primary_contact_phone text,
  stage public.commercial_prospect_stage not null default 'researched',
  source text not null default 'founder_outreach',
  observed_opportunities text[] not null default '{}',
  sales_notes text not null default '',
  recommended_plan_id uuid references public.subscription_plans(id) on delete set null,
  next_action text,
  next_action_due_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger set_commercial_prospects_updated_at before update
  on public.commercial_prospects for each row execute function public.set_updated_at();

alter table public.commercial_prospects enable row level security;
create policy "platform staff manage commercial prospects"
  on public.commercial_prospects for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());
grant select, insert, update, delete on public.commercial_prospects
  to authenticated, service_role;

create type public.demo_configuration_status as enum ('draft', 'review_ready', 'published');

create table public.prospect_demo_configurations (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null unique
    references public.commercial_prospects(id) on delete cascade,
  plan_id uuid references public.subscription_plans(id) on delete set null,
  theme jsonb not null default '{
    "accentColor":"#1a1a1a",
    "surfaceColor":"#f5f3f0",
    "inkColor":"#1a1a1a",
    "displayFont":"paon_editorial",
    "bodyFont":"quiet_sans",
    "cornerStyle":"soft"
  }'::jsonb check (public.is_valid_retailer_brand_theme(theme)),
  marketing_headline text not null default ''
    check (length(marketing_headline) <= 180),
  personalized_introduction text not null default ''
    check (length(personalized_introduction) <= 2000),
  locations jsonb not null default '[]'::jsonb
    check (jsonb_typeof(locations) = 'array' and jsonb_array_length(locations) <= 25),
  product_mix text[] not null default '{}'
    check (product_mix <@ array[
      'tailoring', 'formalwear', 'ready_to_wear', 'accessories',
      'bridal', 'made_to_measure'
    ]),
  status public.demo_configuration_status not null default 'draft',
  current_version integer not null default 0 check (current_version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_prospect_demo_configurations_updated_at before update
  on public.prospect_demo_configurations for each row execute function public.set_updated_at();

create table public.prospect_demo_modules (
  configuration_id uuid not null
    references public.prospect_demo_configurations(id) on delete cascade,
  feature_key text not null references public.commercial_features(key) on delete restrict,
  primary key (configuration_id, feature_key)
);

create table public.prospect_demo_configuration_versions (
  id uuid primary key default gen_random_uuid(),
  configuration_id uuid not null
    references public.prospect_demo_configurations(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null,
  change_note text not null check (length(trim(change_note)) between 2 and 240),
  changed_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (configuration_id, version_number)
);

alter table public.prospect_demo_configurations enable row level security;
alter table public.prospect_demo_modules enable row level security;
alter table public.prospect_demo_configuration_versions enable row level security;

create policy "platform staff manage prospect demo configurations"
  on public.prospect_demo_configurations for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "platform staff manage prospect demo modules"
  on public.prospect_demo_modules for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "platform staff manage prospect demo versions"
  on public.prospect_demo_configuration_versions for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());

grant select, insert, update, delete on public.prospect_demo_configurations,
  public.prospect_demo_modules, public.prospect_demo_configuration_versions
  to authenticated, service_role;

create or replace function public.save_prospect_demo_configuration(
  p_prospect_id uuid,
  p_plan_id uuid,
  p_theme jsonb,
  p_marketing_headline text,
  p_personalized_introduction text,
  p_locations jsonb,
  p_product_mix text[],
  p_feature_keys text[],
  p_change_note text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_configuration_id uuid;
  v_version integer;
  v_snapshot jsonb;
begin
  if not (public.is_platform_staff() or auth.role() = 'service_role') then
    raise exception 'Platform staff access required';
  end if;
  if not public.is_valid_retailer_brand_theme(p_theme)
    or jsonb_typeof(p_locations) <> 'array'
    or jsonb_array_length(p_locations) > 25
    or coalesce(array_length(p_feature_keys, 1), 0) = 0
    or length(p_marketing_headline) > 180
    or length(p_personalized_introduction) > 2000
    or length(trim(p_change_note)) not between 2 and 240
    or not (p_product_mix <@ array[
      'tailoring', 'formalwear', 'ready_to_wear', 'accessories',
      'bridal', 'made_to_measure'
    ])
  then
    raise exception 'Invalid demo configuration';
  end if;
  if exists (
    select 1 from unnest(p_feature_keys) key
    where not exists (select 1 from public.commercial_features f where f.key = key)
  ) then
    raise exception 'Unknown demo capability';
  end if;
  if not exists (
    select 1 from public.commercial_prospects
    where id = p_prospect_id and deleted_at is null
  ) then raise exception 'Prospect not found'; end if;

  insert into public.prospect_demo_configurations (prospect_id)
  values (p_prospect_id)
  on conflict (prospect_id) do update set updated_at = now()
  returning id into v_configuration_id;
  perform 1 from public.prospect_demo_configurations
    where id = v_configuration_id for update;

  select current_version + 1 into v_version
  from public.prospect_demo_configurations where id = v_configuration_id;

  update public.prospect_demo_configurations set
    plan_id = p_plan_id,
    theme = p_theme,
    marketing_headline = trim(p_marketing_headline),
    personalized_introduction = trim(p_personalized_introduction),
    locations = p_locations,
    product_mix = p_product_mix,
    current_version = v_version
  where id = v_configuration_id;

  delete from public.prospect_demo_modules where configuration_id = v_configuration_id;
  insert into public.prospect_demo_modules(configuration_id, feature_key)
    select v_configuration_id, key from unnest(p_feature_keys) key;

  select jsonb_build_object(
    'planId', p_plan_id,
    'theme', p_theme,
    'marketingHeadline', trim(p_marketing_headline),
    'personalizedIntroduction', trim(p_personalized_introduction),
    'locations', p_locations,
    'productMix', to_jsonb(p_product_mix),
    'featureKeys', to_jsonb(p_feature_keys)
  ) into v_snapshot;

  insert into public.prospect_demo_configuration_versions (
    configuration_id, version_number, snapshot, change_note, changed_by_user_id
  ) values (
    v_configuration_id, v_version, v_snapshot, trim(p_change_note), auth.uid()
  );
  update public.commercial_prospects
    set stage = case when stage in ('researched', 'qualified')
      then 'demo_preparation' else stage end
    where id = p_prospect_id;
  return v_version;
end;
$$;

revoke all on function public.save_prospect_demo_configuration(
  uuid, uuid, jsonb, text, text, jsonb, text[], text[], text
) from public;
grant execute on function public.save_prospect_demo_configuration(
  uuid, uuid, jsonb, text, text, jsonb, text[], text[], text
) to authenticated, service_role;
