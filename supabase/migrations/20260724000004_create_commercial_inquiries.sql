-- Public commercial calls-to-action persist as a founder-owned inbox. They do
-- not create a retailer, prospect demo or production tenant automatically.

create type public.commercial_inquiry_type as enum (
  'personalized_demo', 'consultation', 'paid_pilot'
);

create table public.commercial_inquiries (
  id uuid primary key default gen_random_uuid(),
  inquiry_type public.commercial_inquiry_type not null,
  company_name text not null,
  contact_name text not null,
  email text not null,
  website_url text,
  objective text not null,
  requested_plan_key text references public.subscription_plans (key)
    on update cascade on delete set null,
  status text not null default 'new' check (
    status in ('new', 'reviewed', 'converted', 'closed')
  ),
  source text not null default 'paon_marketing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_commercial_inquiries_updated_at
  before update on public.commercial_inquiries
  for each row execute function public.set_updated_at();

alter table public.commercial_inquiries enable row level security;

create policy "platform staff manage commercial inquiries"
  on public.commercial_inquiries for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());

grant select, insert, update, delete on public.commercial_inquiries
  to authenticated, service_role;

create or replace function public.submit_commercial_inquiry(
  p_inquiry_type public.commercial_inquiry_type,
  p_company_name text,
  p_contact_name text,
  p_email text,
  p_website_url text,
  p_objective text,
  p_requested_plan_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if length(trim(p_company_name)) not between 2 and 160
    or length(trim(p_contact_name)) not between 2 and 160
    or length(trim(p_objective)) not between 10 and 2000
    or length(trim(p_email)) > 320
    or trim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or (p_website_url is not null and length(trim(p_website_url)) > 500)
  then
    raise exception 'Invalid commercial inquiry';
  end if;

  insert into public.commercial_inquiries (
    inquiry_type, company_name, contact_name, email, website_url, objective,
    requested_plan_key
  ) values (
    p_inquiry_type,
    trim(p_company_name),
    trim(p_contact_name),
    lower(trim(p_email)),
    nullif(trim(p_website_url), ''),
    trim(p_objective),
    nullif(trim(p_requested_plan_key), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_commercial_inquiry(
  public.commercial_inquiry_type, text, text, text, text, text, text
) from public;
grant execute on function public.submit_commercial_inquiry(
  public.commercial_inquiry_type, text, text, text, text, text, text
) to anon, authenticated, service_role;
