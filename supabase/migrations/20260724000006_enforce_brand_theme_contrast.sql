create or replace function public.hex_color_relative_luminance(p_hex text)
returns double precision
language plpgsql
immutable
strict
as $$
declare
  r double precision;
  g double precision;
  b double precision;
begin
  r := ('x' || substr(p_hex, 2, 2))::bit(8)::integer / 255.0;
  g := ('x' || substr(p_hex, 4, 2))::bit(8)::integer / 255.0;
  b := ('x' || substr(p_hex, 6, 2))::bit(8)::integer / 255.0;
  r := case when r <= 0.04045 then r / 12.92 else power((r + 0.055) / 1.055, 2.4) end;
  g := case when g <= 0.04045 then g / 12.92 else power((g + 0.055) / 1.055, 2.4) end;
  b := case when b <= 0.04045 then b / 12.92 else power((b + 0.055) / 1.055, 2.4) end;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
end;
$$;

create or replace function public.hex_color_contrast_ratio(
  p_first text,
  p_second text
)
returns double precision
language sql
immutable
strict
as $$
  select
    (greatest(
      public.hex_color_relative_luminance(p_first),
      public.hex_color_relative_luminance(p_second)
    ) + 0.05)
    /
    (least(
      public.hex_color_relative_luminance(p_first),
      public.hex_color_relative_luminance(p_second)
    ) + 0.05);
$$;

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
    )
    and (
      not (p_theme ? 'faviconUrl') or p_theme->>'faviconUrl' = ''
      or p_theme->>'faviconUrl' ~ '^https://'
    )
    and (
      not (p_theme ? 'heroImageUrl') or p_theme->>'heroImageUrl' = ''
      or p_theme->>'heroImageUrl' ~ '^https://'
    );
$$;
