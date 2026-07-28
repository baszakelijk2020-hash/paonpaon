-- Prospect garment photography for Demo Studio demos.
-- URLs come from the brand-asset library; applied onto seeded products
-- at generate time so /r/{slug} shows the prospect's pieces.

alter table public.prospect_demo_configurations
  add column if not exists product_image_urls text[] not null default '{}';

alter table public.prospect_demo_configurations
  drop constraint if exists prospect_demo_configurations_product_image_urls_check;

alter table public.prospect_demo_configurations
  add constraint prospect_demo_configurations_product_image_urls_check
  check (coalesce(cardinality(product_image_urls), 0) <= 24);

drop function if exists public.save_prospect_demo_configuration(
  uuid, uuid, jsonb, text, text, jsonb, text[], text[], text
);

create or replace function public.save_prospect_demo_configuration(
  p_prospect_id uuid,
  p_plan_id uuid,
  p_theme jsonb,
  p_marketing_headline text,
  p_personalized_introduction text,
  p_locations jsonb,
  p_product_mix text[],
  p_feature_keys text[],
  p_change_note text,
  p_product_image_urls text[] default '{}'
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
    or coalesce(cardinality(p_product_image_urls), 0) > 24
    or exists (
      select 1 from unnest(coalesce(p_product_image_urls, '{}')) as url
      where url !~ '^https://' or length(url) > 1000
    )
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
    product_image_urls = coalesce(p_product_image_urls, '{}'),
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
    'productImageUrls', to_jsonb(coalesce(p_product_image_urls, '{}')),
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
  uuid, uuid, jsonb, text, text, jsonb, text[], text[], text, text[]
) from public;
grant execute on function public.save_prospect_demo_configuration(
  uuid, uuid, jsonb, text, text, jsonb, text[], text[], text, text[]
) to authenticated, service_role;
