-- Reusable JWT claim readers for RLS policies. Every table's policy from
-- this point forward reads the caller's identity through these
-- functions rather than inlining `auth.jwt() -> ...` — one place to
-- fix if the claim shape ever changes. See docs/DATABASE.md
-- "Row Level Security".

create or replace function public.current_platform_role()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'platform_role', '')
$$;

create or replace function public.is_platform_staff()
returns boolean
language sql
stable
as $$
  select public.current_platform_role() is not null
$$;

create or replace function public.current_retailer_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'retailer_id', '')::uuid
$$;

create or replace function public.current_retailer_role()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'retailer_role', '')
$$;
