-- Local Supabase serves Storage over loopback HTTP. Keep production assets
-- HTTPS-only while allowing the actual local demo environment to use its own
-- uploaded files.
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
    and public.hex_color_contrast_ratio(
      p_theme->>'surfaceColor', p_theme->>'inkColor'
    ) >= 4.5
    and p_theme->>'displayFont' in ('paon_editorial', 'heritage', 'modern')
    and p_theme->>'bodyFont' in ('quiet_sans', 'humanist')
    and p_theme->>'cornerStyle' in ('tailored', 'soft', 'architectural')
    and (
      not (p_theme ? 'logoUrl') or p_theme->>'logoUrl' = ''
      or p_theme->>'logoUrl' ~ '^https://'
      or p_theme->>'logoUrl' ~ '^http://(127\.0\.0\.1|localhost)(:[0-9]+)?/'
    )
    and (
      not (p_theme ? 'faviconUrl') or p_theme->>'faviconUrl' = ''
      or p_theme->>'faviconUrl' ~ '^https://'
      or p_theme->>'faviconUrl' ~ '^http://(127\.0\.0\.1|localhost)(:[0-9]+)?/'
    )
    and (
      not (p_theme ? 'heroImageUrl') or p_theme->>'heroImageUrl' = ''
      or p_theme->>'heroImageUrl' ~ '^https://'
      or p_theme->>'heroImageUrl' ~ '^http://(127\.0\.0\.1|localhost)(:[0-9]+)?/'
    );
$$;
