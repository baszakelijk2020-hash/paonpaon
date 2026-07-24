-- One curated brand-token vocabulary serves live retailers, future demos and
-- proposals. Arbitrary CSS, scripts and HTML are deliberately not representable.

create or replace function public.is_valid_retailer_brand_theme(p_theme jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    jsonb_typeof(p_theme) = 'object'
    and p_theme ?& array[
      'accentColor', 'surfaceColor', 'inkColor', 'displayFont', 'bodyFont',
      'cornerStyle'
    ]
    and not exists (
      select 1 from jsonb_object_keys(p_theme) as key
      where key <> all(array[
        'logoUrl', 'faviconUrl', 'heroImageUrl', 'accentColor', 'surfaceColor',
        'inkColor', 'displayFont', 'bodyFont', 'cornerStyle'
      ])
    )
    and (p_theme->>'accentColor') ~ '^#[0-9a-fA-F]{6}$'
    and (p_theme->>'surfaceColor') ~ '^#[0-9a-fA-F]{6}$'
    and (p_theme->>'inkColor') ~ '^#[0-9a-fA-F]{6}$'
    and p_theme->>'displayFont' in ('paon_editorial', 'heritage', 'modern')
    and p_theme->>'bodyFont' in ('quiet_sans', 'humanist')
    and p_theme->>'cornerStyle' in ('tailored', 'soft', 'architectural')
    and (
      not (p_theme ? 'logoUrl')
      or p_theme->>'logoUrl' = ''
      or p_theme->>'logoUrl' ~ '^https://'
    )
    and (
      not (p_theme ? 'faviconUrl')
      or p_theme->>'faviconUrl' = ''
      or p_theme->>'faviconUrl' ~ '^https://'
    )
    and (
      not (p_theme ? 'heroImageUrl')
      or p_theme->>'heroImageUrl' = ''
      or p_theme->>'heroImageUrl' ~ '^https://'
    );
$$;

update public.retailers
set brand_theme = jsonb_build_object(
  'accentColor', coalesce(nullif(brand_theme->>'accentColor', ''), '#1a1a1a'),
  'surfaceColor', '#f5f3f0',
  'inkColor', '#1a1a1a',
  'displayFont',
    case when brand_theme->>'displayFont' in ('paon_editorial', 'heritage', 'modern')
      then brand_theme->>'displayFont' else 'paon_editorial' end,
  'bodyFont', 'quiet_sans',
  'cornerStyle', 'soft'
) || case when coalesce(brand_theme->>'logoUrl', '') ~ '^https://'
  then jsonb_build_object('logoUrl', brand_theme->>'logoUrl') else '{}'::jsonb end;

alter table public.retailers
  add constraint retailers_brand_theme_is_valid
  check (public.is_valid_retailer_brand_theme(brand_theme));

alter table public.retailers
  alter column brand_theme set default '{
    "accentColor":"#1a1a1a",
    "surfaceColor":"#f5f3f0",
    "inkColor":"#1a1a1a",
    "displayFont":"paon_editorial",
    "bodyFont":"quiet_sans",
    "cornerStyle":"soft"
  }'::jsonb;

create table public.retailer_brand_theme_versions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  theme jsonb not null check (public.is_valid_retailer_brand_theme(theme)),
  change_note text not null check (length(trim(change_note)) between 2 and 240),
  changed_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (retailer_id, version_number)
);

create index retailer_brand_theme_versions_retailer_idx
  on public.retailer_brand_theme_versions(retailer_id, version_number desc);

alter table public.retailer_brand_theme_versions enable row level security;

create policy "platform staff manage retailer theme versions"
  on public.retailer_brand_theme_versions for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());

create policy "retailer owners and admins read theme versions"
  on public.retailer_brand_theme_versions for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'admin')
  );

grant select, insert, update, delete on public.retailer_brand_theme_versions
  to authenticated, service_role;

create or replace function public.save_retailer_brand_theme(
  p_retailer_id uuid,
  p_theme jsonb,
  p_change_note text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version integer;
begin
  if not (
    public.is_platform_staff()
    or (
      p_retailer_id = public.current_retailer_id()
      and public.current_retailer_role() in ('owner', 'admin')
    )
    or auth.role() = 'service_role'
  ) then
    raise exception 'Not authorized to configure this retailer theme';
  end if;

  if not public.is_valid_retailer_brand_theme(p_theme)
    or length(trim(p_change_note)) not between 2 and 240
  then
    raise exception 'Invalid retailer brand theme';
  end if;

  perform 1 from public.retailers where id = p_retailer_id for update;
  if not found then raise exception 'Retailer not found'; end if;

  select coalesce(max(version_number), 0) + 1 into v_version
  from public.retailer_brand_theme_versions
  where retailer_id = p_retailer_id;

  insert into public.retailer_brand_theme_versions (
    retailer_id, version_number, theme, change_note, changed_by_user_id
  ) values (
    p_retailer_id, v_version, p_theme, trim(p_change_note), auth.uid()
  );

  update public.retailers set brand_theme = p_theme where id = p_retailer_id;
  return v_version;
end;
$$;

revoke all on function public.save_retailer_brand_theme(uuid, jsonb, text)
  from public;
grant execute on function public.save_retailer_brand_theme(uuid, jsonb, text)
  to authenticated, service_role;

create or replace function public.restore_retailer_brand_theme(
  p_retailer_id uuid,
  p_version_number integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_theme jsonb;
begin
  if not (
    public.is_platform_staff()
    or (
      p_retailer_id = public.current_retailer_id()
      and public.current_retailer_role() in ('owner', 'admin')
    )
    or auth.role() = 'service_role'
  ) then
    raise exception 'Not authorized to restore this retailer theme';
  end if;

  select theme into v_theme
  from public.retailer_brand_theme_versions
  where retailer_id = p_retailer_id and version_number = p_version_number;
  if not found then raise exception 'Theme version not found'; end if;

  return public.save_retailer_brand_theme(
    p_retailer_id, v_theme, 'Restored version ' || p_version_number
  );
end;
$$;

revoke all on function public.restore_retailer_brand_theme(uuid, integer)
  from public;
grant execute on function public.restore_retailer_brand_theme(uuid, integer)
  to authenticated, service_role;

create or replace function public.enforce_retailer_staff_editable_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role'
    or current_user <> session_user
    or public.is_platform_staff()
  then
    return new;
  end if;

  if new.status is distinct from old.status
    or new.tier is distinct from old.tier
    or new.slug is distinct from old.slug
    or new.default_currency is distinct from old.default_currency
    or new.brand_theme is distinct from old.brand_theme
  then
    raise exception
      'Retailer staff may only update profile fields directly; platform fields and brand themes use their dedicated workflows';
  end if;

  return new;
end;
$$;
