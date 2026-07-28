-- Demo Studio A.4: teardown ties the seeded retailer's reachability to the
-- demo environment. Unpublish / expiry suspend the retailer; re-publish
-- reactivates it. /r/{slug} already 404s when status <> 'active' — no
-- demo-specific gate on the storefront route.

create or replace function public.set_prospect_demo_publication(
  p_prospect_id uuid,
  p_publish boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_retailer_id uuid;
begin
  if not (public.is_platform_staff() or auth.role() = 'service_role') then
    raise exception 'Platform staff access required';
  end if;
  update public.prospect_demo_environments set
    status = case when p_publish then 'published'::public.prospect_demo_environment_status
      else 'revoked'::public.prospect_demo_environment_status end,
    published_at = case when p_publish then now() else published_at end,
    revoked_at = case when p_publish then null else now() end
  where prospect_id = p_prospect_id and expires_at > now()
  returning retailer_id into v_retailer_id;
  if not found then raise exception 'Current demo environment not found'; end if;
  if v_retailer_id is not null then
    update public.retailers set
      status = case when p_publish
        then 'active'::public.retailer_status
        else 'suspended'::public.retailer_status end
    where id = v_retailer_id;
  end if;
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

create or replace function public.expire_due_prospect_demo_environments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  if not (public.is_platform_staff() or auth.role() = 'service_role') then
    raise exception 'Platform staff access required';
  end if;
  for r in
    select id, retailer_id
    from public.prospect_demo_environments
    where status = 'published'::public.prospect_demo_environment_status
      and expires_at <= now()
    for update
  loop
    update public.prospect_demo_environments
      set status = 'expired'::public.prospect_demo_environment_status
      where id = r.id;
    if r.retailer_id is not null then
      update public.retailers
        set status = 'suspended'::public.retailer_status
        where id = r.retailer_id;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
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
  if not found then
    return null;
  end if;

  -- Past expiry while still marked published: tear down now so /r/{slug}
  -- stops serving even if the hourly cron has not fired yet.
  if v_environment.status = 'published'::public.prospect_demo_environment_status
    and v_environment.expires_at <= now()
  then
    update public.prospect_demo_environments
      set status = 'expired'::public.prospect_demo_environment_status
      where id = v_environment.id;
    if v_environment.retailer_id is not null then
      update public.retailers
        set status = 'suspended'::public.retailer_status
        where id = v_environment.retailer_id;
    end if;
    return null;
  end if;

  if v_environment.status <> 'published'
    or v_environment.retailer_slug is null
  then
    return null;
  end if;

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

revoke all on function public.expire_due_prospect_demo_environments() from public;
grant execute on function public.expire_due_prospect_demo_environments()
  to authenticated, service_role;
