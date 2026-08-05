-- FT-03 QR try-on and fabric-batch concept order — first connected slice
-- (docs/FOUNDER_TOOL_BLUEPRINTS.md). `pag1.html`'s own fragment (`#qr`,
-- around u568996/u569022/u569149) is decorative marketing mockup imagery —
-- static QR-icon glyphs inside a garment-tag illustration, no interactive
-- scan/resolve widget — so per AGENTS.md's non-designated-source path this
-- is built with PAON's own primitives against the blueprint's PAON-job/
-- state description, not a pixel port.
--
-- Scope cut, named honestly: real camera QR decoding needs a barcode
-- library this codebase has none of (same "no new heavy dependency"
-- reasoning already applied to GSAP/Cesium elsewhere in this programme).
-- The blueprint itself requires "manual code entry is mandatory" as an
-- always-present path, not just a fallback, so this slice builds that
-- path first and completely; a camera scanner can be layered on top later
-- without touching this schema, since both ultimately just supply a code
-- string to the same resolve/add RPCs.
--
-- "Batch" in this first slice lives at the CUSTOMER side: each physical
-- Try-On/fabric swatch gets its own opaque, rotatable, expiring code
-- (`concept_scan_codes`), and a customer's own accumulated scans across a
-- shopping visit form one running "concept order" selection
-- (`concept_order_selections`/`_items`) they explicitly send to their
-- advisor — the same "records a selection outcome for the advisor to
-- convert manually" boundary FT-10's gift booklet already established,
-- so this creates no Order and touches no stock (R0.2's boundary).
-- Retailer-side pre-curated multi-item batches/campaigns are not built.

create table public.concept_scan_codes (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  product_variant_id uuid not null references public.product_variants (id) on delete cascade,
  kind text not null check (kind in ('try_on', 'fabric_swatch')),
  code text not null unique,
  status text not null default 'active' check (status in ('active', 'recalled')),
  expires_at timestamptz,
  superseded_by_code_id uuid references public.concept_scan_codes (id) on delete set null,
  created_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index concept_scan_codes_retailer_idx on public.concept_scan_codes (retailer_id);
create index concept_scan_codes_variant_idx on public.concept_scan_codes (product_variant_id);

-- Short, human-typable code (manual entry is mandatory, not a fallback) —
-- 8 uppercase hex characters, collision odds negligible at this scale;
-- the unique constraint above is the real backstop, same as gift/wardrobe
-- tokens accepting a (vanishingly unlikely) insert failure on collision
-- rather than a retry loop.
create or replace function public.generate_concept_scan_code()
returns text
language sql
volatile
as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

alter table public.concept_scan_codes
  alter column code set default public.generate_concept_scan_code();

create table public.concept_order_selections (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index concept_order_selections_one_draft_idx
  on public.concept_order_selections (customer_id, retailer_id)
  where status = 'draft';
create trigger set_concept_order_selections_updated_at
  before update on public.concept_order_selections
  for each row execute function public.set_updated_at();

create table public.concept_order_selection_items (
  id uuid primary key default gen_random_uuid(),
  selection_id uuid not null references public.concept_order_selections (id) on delete cascade,
  scan_code_id uuid not null references public.concept_scan_codes (id) on delete cascade,
  added_at timestamptz not null default now(),
  unique (selection_id, scan_code_id)
);
create index concept_order_selection_items_selection_idx
  on public.concept_order_selection_items (selection_id);

alter table public.concept_scan_codes enable row level security;
alter table public.concept_order_selections enable row level security;
alter table public.concept_order_selection_items enable row level security;

create policy "platform manages concept scan codes"
  on public.concept_scan_codes for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());
create policy "retailer staff read concept scan codes"
  on public.concept_scan_codes for select
  using (retailer_id = public.current_retailer_id());
create policy "retailer managers manage concept scan codes"
  on public.concept_scan_codes for all
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  );

-- Selections/items are written only through the RPCs below (same "narrow
-- RPC, self-deriving caller identity" shape as toggle_wishlist_item) —
-- RLS here grants read visibility only.
create policy "platform reads all concept order selections"
  on public.concept_order_selections for select
  using (public.is_platform_staff());
create policy "a customer reads their own concept order selections"
  on public.concept_order_selections for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = concept_order_selections.customer_id
        and c.user_id = auth.uid()
    )
  );
create policy "retailer staff read their retailer's concept order selections"
  on public.concept_order_selections for select
  using (retailer_id = public.current_retailer_id());

create policy "platform reads all concept order selection items"
  on public.concept_order_selection_items for select
  using (public.is_platform_staff());
create policy "a customer reads their own concept order selection items"
  on public.concept_order_selection_items for select
  using (
    exists (
      select 1 from public.concept_order_selections s
      join public.customers c on c.id = s.customer_id
      where s.id = concept_order_selection_items.selection_id
        and c.user_id = auth.uid()
    )
  );
create policy "retailer staff read their retailer's concept order selection items"
  on public.concept_order_selection_items for select
  using (
    exists (
      select 1 from public.concept_order_selections s
      where s.id = concept_order_selection_items.selection_id
        and s.retailer_id = public.current_retailer_id()
    )
  );

-- Anonymous, opaque-code resolution — full item/House info, no customer
-- identity involved, same non-goal as resolve_gift_invitation/
-- resolve_wardrobe_item_public. The caller compares the returned
-- `retailerSlug` against the House it is currently browsing to render the
-- "wrong House" state; real cross-tenant enforcement happens in
-- add_concept_scan_selection below, not here.
create or replace function public.resolve_concept_scan_code(
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_scan public.concept_scan_codes%rowtype;
  v_retailer public.retailers%rowtype;
  v_effective_status text;
begin
  select * into v_scan
    from public.concept_scan_codes
    where code = upper(trim(p_code));
  if not found then
    return jsonb_build_object('status', 'unknown');
  end if;

  select * into v_retailer
    from public.retailers
    where id = v_scan.retailer_id and deleted_at is null;
  if not found or v_retailer.status <> 'active' then
    return jsonb_build_object('status', 'unknown');
  end if;

  if v_scan.status = 'recalled' then
    v_effective_status := 'recalled';
  elsif v_scan.expires_at is not null and v_scan.expires_at < now() then
    v_effective_status := 'expired';
  else
    v_effective_status := 'active';
  end if;

  return jsonb_build_object(
    'status', v_effective_status,
    'code', v_scan.code,
    'kind', v_scan.kind,
    'retailerId', v_scan.retailer_id,
    'retailerDisplayName', v_retailer.display_name,
    'retailerSlug', v_retailer.slug,
    'productVariantId', v_scan.product_variant_id,
    'productName', (
      select p.name from public.product_variants pv
        join public.products p on p.id = pv.product_id
        where pv.id = v_scan.product_variant_id
    ),
    'variantLabel', (
      select concat_ws(' · ', pv.size, pv.color) from public.product_variants pv
        where pv.id = v_scan.product_variant_id
    ),
    'priceAmountMinorUnits', (
      select pv.price_amount_minor_units from public.product_variants pv
        where pv.id = v_scan.product_variant_id
    ),
    'priceCurrency', (
      select pv.price_currency from public.product_variants pv
        where pv.id = v_scan.product_variant_id
    ),
    'primaryImageUrl', (
      select p.primary_image_url from public.product_variants pv
        join public.products p on p.id = pv.product_id
        where pv.id = v_scan.product_variant_id
    )
  );
end;
$$;

-- Authenticated add-to-selection. Re-derives the caller's own Customer row
-- and finds-or-creates their open draft selection (same shape as
-- toggle_wishlist_item), then enforces the real House boundary a code
-- cannot cross: `p_retailer_id` is the House the customer is currently
-- signed into (the customer app is single-tenant per session), and a
-- code minted for a different retailer is refused here, not silently
-- accepted.
create or replace function public.add_concept_scan_selection(
  p_retailer_id uuid,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_scan public.concept_scan_codes%rowtype;
  v_customer_id uuid;
  v_selection_id uuid;
  v_item_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_scan
    from public.concept_scan_codes
    where code = upper(trim(p_code));
  if not found then
    raise exception 'This code is not valid';
  end if;
  if v_scan.retailer_id <> p_retailer_id then
    raise exception 'This code belongs to a different House';
  end if;
  if v_scan.status = 'recalled' then
    raise exception 'This code has been recalled';
  end if;
  if v_scan.expires_at is not null and v_scan.expires_at < now() then
    raise exception 'This code has expired';
  end if;

  select id into v_customer_id from public.customers
    where retailer_id = p_retailer_id and user_id = auth.uid() and deleted_at is null
    limit 1;
  if v_customer_id is null then
    insert into public.customers (retailer_id, user_id, full_name, email, lifecycle_stage)
    values (p_retailer_id, auth.uid(), coalesce(auth.jwt() ->> 'email', 'Customer'), auth.jwt() ->> 'email', 'prospect')
    returning id into v_customer_id;
    insert into public.customer_account_links (user_id, customer_id, retailer_id)
    values (auth.uid(), v_customer_id, p_retailer_id)
    on conflict (user_id, customer_id) do nothing;
  end if;

  insert into public.concept_order_selections (customer_id, retailer_id)
    values (v_customer_id, p_retailer_id)
    on conflict (customer_id, retailer_id) where status = 'draft' do nothing;
  select id into v_selection_id from public.concept_order_selections
    where customer_id = v_customer_id and retailer_id = p_retailer_id and status = 'draft';

  insert into public.concept_order_selection_items (selection_id, scan_code_id)
    values (v_selection_id, v_scan.id)
    on conflict (selection_id, scan_code_id) do nothing;

  select count(*) into v_item_count
    from public.concept_order_selection_items where selection_id = v_selection_id;

  return jsonb_build_object('selectionId', v_selection_id, 'itemCount', v_item_count);
end;
$$;

-- Explicit "Send to advisor" decision — a customer's accumulated scans
-- become reviewable only on this deliberate act, matching this codebase's
-- recurring "explicit action, not implicit side effect" precedent (swipe
-- deck saves, suit configurator saves, gift invitation dispatch).
create or replace function public.submit_concept_selection(
  p_selection_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_selection public.concept_order_selections%rowtype;
  v_item_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select s.* into v_selection
    from public.concept_order_selections s
    join public.customers c on c.id = s.customer_id
    where s.id = p_selection_id and c.user_id = auth.uid();
  if not found then
    raise exception 'Selection not found';
  end if;
  if v_selection.status <> 'draft' then
    raise exception 'This selection has already been sent';
  end if;

  select count(*) into v_item_count
    from public.concept_order_selection_items where selection_id = p_selection_id;
  if v_item_count = 0 then
    raise exception 'Add at least one piece before sending to your advisor';
  end if;

  update public.concept_order_selections
    set status = 'submitted', submitted_at = now()
    where id = p_selection_id;
end;
$$;

revoke all on function public.resolve_concept_scan_code(text) from public;
revoke all on function public.add_concept_scan_selection(uuid, text) from public;
revoke all on function public.submit_concept_selection(uuid) from public;
grant execute on function public.resolve_concept_scan_code(text)
  to anon, authenticated, service_role;
grant execute on function public.add_concept_scan_selection(uuid, text)
  to authenticated, service_role;
grant execute on function public.submit_concept_selection(uuid)
  to authenticated, service_role;

-- Full table CRUD is granted to both roles uniformly, matching this
-- codebase's convention (e.g. wishlists/wishlist_items): RLS — not the
-- grant — is the real enforcement boundary for `authenticated` (no
-- INSERT/UPDATE/DELETE policy exists for the selection tables, so a
-- signed-in customer still cannot write them directly, only through the
-- RPCs above). `service_role` bypasses RLS entirely, so its grant is
-- what lets admin-client fixture seeding/cleanup in tests work at all.
grant select, insert, update, delete on public.concept_scan_codes
  to authenticated, service_role;
grant select, insert, update, delete
  on public.concept_order_selections, public.concept_order_selection_items
  to authenticated, service_role;
