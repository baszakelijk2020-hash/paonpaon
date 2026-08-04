-- PHASE 18.4 (BD-104): corporate campaign / office-visit landing pages.
--
-- Scope is deliberately narrow: a public, company-branded page per
-- programme, and a lead-capture request an employee submits from it.
-- Turning a request into an actual scheduled fitting slot against
-- advisor/room capacity is 18.6's own item, not duplicated here — this
-- table is the intake queue staff work from, the same relationship
-- `corporate_exceptions` has to resolution, not a booking calendar.
--
-- No anonymous RLS insert policy on this table, matching
-- `submit_table_service_inquiry`/`join_wedding_party` (ADR-034: "no new
-- anonymous RLS insert path, no auth bypass"). The single `security
-- definer` RPC below is the only way an unauthenticated visitor reaches
-- it.

create table if not exists public.corporate_office_visit_requests (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  programme_id uuid not null
    references public.corporate_programmes (id) on delete cascade,
  requester_name text not null check (char_length(btrim(requester_name)) between 1 and 200),
  employee_reference text check (
    employee_reference is null or char_length(btrim(employee_reference)) <= 64
  ),
  contact_email text check (
    contact_email is null
    or contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  note text check (note is null or char_length(btrim(note)) <= 2000),
  status text not null default 'open' check (
    status in ('open', 'contacted', 'scheduled', 'declined')
  ),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint corporate_office_visit_requests_resolution check (
    (status = 'open') = (resolved_at is null)
  )
);

create index if not exists corporate_office_visit_requests_open_idx
  on public.corporate_office_visit_requests (programme_id, created_at)
  where status = 'open';

create trigger set_corporate_office_visit_requests_updated_at
  before update on public.corporate_office_visit_requests
  for each row execute function public.set_updated_at();

alter table public.corporate_office_visit_requests enable row level security;
revoke all on table public.corporate_office_visit_requests from public, anon;
grant select, update on table public.corporate_office_visit_requests
  to authenticated, service_role;

create policy corporate_office_visit_requests_retailer_select
  on public.corporate_office_visit_requests for select to authenticated using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

create policy corporate_office_visit_requests_staff_update
  on public.corporate_office_visit_requests for update to authenticated using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in
      ('owner', 'manager', 'admin', 'sales_associate')
  ) with check (retailer_id = public.current_retailer_id());

-- Public, company-branded landing page data: account/programme name only
-- — never wearer names, never other clients, never margins.
create or replace function public.resolve_corporate_office_visit_page(
  p_programme_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_programme public.corporate_programmes%rowtype;
  v_account public.corporate_accounts%rowtype;
  v_retailer public.retailers%rowtype;
begin
  select * into v_programme
    from public.corporate_programmes
    where id = p_programme_id and deleted_at is null and active;
  if not found then
    raise exception 'This programme page is not available';
  end if;

  select * into v_account
    from public.corporate_accounts
    where id = v_programme.account_id and deleted_at is null and active;
  if not found then
    raise exception 'This programme page is not available';
  end if;

  select * into v_retailer
    from public.retailers
    where id = v_programme.retailer_id and deleted_at is null;
  if not found or v_retailer.status <> 'active' then
    raise exception 'This programme page is not available';
  end if;

  return jsonb_build_object(
    'retailerDisplayName', v_retailer.display_name,
    'companyName', v_account.legal_name,
    'programmeName', v_programme.name
  );
end;
$$;

create or replace function public.submit_corporate_office_visit_request(
  p_programme_id uuid,
  p_requester_name text,
  p_employee_reference text,
  p_contact_email text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_programme public.corporate_programmes%rowtype;
  v_name text := trim(p_requester_name);
  v_employee_reference text := nullif(trim(coalesce(p_employee_reference, '')), '');
  v_contact_email text := nullif(lower(trim(coalesce(p_contact_email, ''))), '');
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_id uuid;
begin
  if v_name = '' or char_length(v_name) > 200 then
    raise exception 'Name must be 1 to 200 characters';
  end if;
  if v_contact_email is not null
     and v_contact_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email or leave it blank';
  end if;

  select * into v_programme
    from public.corporate_programmes
    where id = p_programme_id and deleted_at is null and active;
  if not found then
    raise exception 'This programme page is not available';
  end if;

  insert into public.corporate_office_visit_requests (
    retailer_id, programme_id, requester_name, employee_reference,
    contact_email, note
  ) values (
    v_programme.retailer_id, p_programme_id, v_name, v_employee_reference,
    v_contact_email, v_note
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.resolve_corporate_office_visit_page(uuid) from public;
revoke all on function public.submit_corporate_office_visit_request(uuid, text, text, text, text) from public;
grant execute on function public.resolve_corporate_office_visit_page(uuid)
  to anon, authenticated, service_role;
grant execute on function public.submit_corporate_office_visit_request(uuid, text, text, text, text)
  to anon, authenticated, service_role;

comment on table public.corporate_office_visit_requests is
  'PHASE 18.4 / BD-104. The intake queue a company-branded office-visit '
  'landing page feeds — staff work it to resolution, same shape as '
  'corporate_exceptions. Turning a request into a scheduled slot against '
  'real capacity is 18.6, not this table.';
