-- Newsletter signup on the storefront front door — deliberately a
-- lighter-weight concept than Customer (a browser signing up for
-- emails hasn't started a purchase relationship yet, matching
-- TableService's guest-Customer pattern but even lighter: no
-- Customer row at all until they actually buy or message the
-- retailer).

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  email text not null,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (retailer_id, email)
);
create index newsletter_subscribers_retailer_idx on public.newsletter_subscribers (retailer_id)
  where unsubscribed_at is null;
create trigger set_newsletter_subscribers_updated_at
  before update on public.newsletter_subscribers
  for each row execute function public.set_updated_at();

alter table public.newsletter_subscribers enable row level security;

create policy "platform reads newsletter subscribers" on public.newsletter_subscribers
  for select using (public.is_platform_staff());
create policy "retailer staff read their newsletter subscribers" on public.newsletter_subscribers
  for select using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  );

grant select on public.newsletter_subscribers to authenticated, service_role;

-- The only anonymous write on this table — same shape as
-- submit_table_service_inquiry (ADR-034): a single narrow
-- security-definer entry point, no anonymous RLS insert policy.
-- Idempotent (re-subscribing after unsubscribing just clears the flag).
create or replace function public.subscribe_to_newsletter(
  p_retailer_id uuid,
  p_email text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'A valid email is required';
  end if;
  if not exists (select 1 from public.retailers where id = p_retailer_id and deleted_at is null) then
    raise exception 'Retailer unavailable';
  end if;

  insert into public.newsletter_subscribers (retailer_id, email)
    values (p_retailer_id, v_email)
    on conflict (retailer_id, email)
    do update set unsubscribed_at = null, subscribed_at = now();
end;
$$;

revoke all on function public.subscribe_to_newsletter(uuid, text) from public;
grant execute on function public.subscribe_to_newsletter(uuid, text) to anon, authenticated, service_role;
