-- PHASE 18.2 (BD-102): corporate tenders, versioned and immutable.
--
-- `corporate_tender_versions` has no update or delete grant at all — the
-- same discipline `corporate_entitlement_versions` (14.1) already applies
-- to policy, applied here to commercial content. Approval is its own
-- append-only fact in `corporate_tender_approvals` rather than a mutable
-- flag on the version, and a `unique` constraint on `tender_version_id`
-- is what actually prevents double-approval — not application code alone.

create table if not exists public.corporate_tenders (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  opportunity_id uuid not null
    references public.corporate_opportunities (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists corporate_tenders_opportunity_idx
  on public.corporate_tenders (opportunity_id, created_at desc);

create table if not exists public.corporate_tender_versions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  tender_id uuid not null references public.corporate_tenders (id) on delete cascade,
  version integer not null check (version >= 1),
  summary text not null check (char_length(btrim(summary)) between 3 and 4000),
  -- Non-empty by CHECK: a tender with no garment concepts is not a tender.
  garment_concepts text[] not null,
  pricing_note text check (
    pricing_note is null or char_length(btrim(pricing_note)) <= 2000
  ),
  created_at timestamptz not null default now(),
  created_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  constraint corporate_tender_version_unique unique (tender_id, version),
  constraint corporate_tender_version_concepts_non_empty check (
    array_length(garment_concepts, 1) is not null
    and array_length(garment_concepts, 1) > 0
  )
);

create index if not exists corporate_tender_versions_tender_idx
  on public.corporate_tender_versions (tender_id, version desc);

create table if not exists public.corporate_tender_approvals (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  tender_version_id uuid not null
    references public.corporate_tender_versions (id) on delete cascade,
  approved_by_staff_id uuid not null
    references public.retailer_staff_members (id) on delete restrict,
  approved_at timestamptz not null default now(),
  -- The constraint that actually prevents double-approval.
  constraint corporate_tender_approval_unique unique (tender_version_id)
);

create trigger set_corporate_tenders_updated_at
  before update on public.corporate_tenders
  for each row execute function public.set_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array[
    'corporate_tenders', 'corporate_tender_versions',
    'corporate_tender_approvals'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon', t);
    execute format(
      'grant select on table public.%I to authenticated, service_role', t
    );
    execute format(
      'create policy %I on public.%I for select to authenticated using ('
      || 'retailer_id = public.current_retailer_id() '
      || 'and public.current_retailer_role() is not null)',
      t || '_retailer_select', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ('
      || 'retailer_id = public.current_retailer_id() '
      || 'and public.current_retailer_role() in '
      || '(''owner'', ''manager'', ''admin'', ''sales_associate''))',
      t || '_staff_insert', t
    );
  end loop;
end $$;

-- corporate_tenders may be renamed/retitled; its versions and approvals
-- are append-only (insert grant only, never update).
grant insert, update on table public.corporate_tenders
  to authenticated, service_role;
grant insert on table public.corporate_tender_versions
  to authenticated, service_role;
grant insert on table public.corporate_tender_approvals
  to authenticated, service_role;

create policy corporate_tenders_staff_update
  on public.corporate_tenders for update to authenticated using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in
      ('owner', 'manager', 'admin', 'sales_associate')
  ) with check (retailer_id = public.current_retailer_id());

comment on table public.corporate_tender_versions is
  'PHASE 18.2 / BD-102. Insert-only, never updated or deleted: a tender a '
  'company has seen must have a history nobody can quietly rewrite.';
comment on table public.corporate_tender_approvals is
  'PHASE 18.2 / BD-102. Append-only. The unique constraint on '
  'tender_version_id, not application code, is what prevents a version '
  'from being approved twice.';
