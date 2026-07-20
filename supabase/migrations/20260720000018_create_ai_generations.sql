-- AI personalisation (founder decision, docs/DECISIONS.md ADR-033):
-- OpenAI behind a provider-neutral interface (@paon/ai). Every
-- generation attempt is recorded — success or failure — doubling as
-- both the per-customer history shown in Retailer Portal and the
-- cross-retailer monitoring surface in PAON Admin.

create type public.ai_generation_kind as enum (
  'next_best_action', 'product_recommendation', 'communication_draft'
);

create type public.ai_generation_status as enum ('succeeded', 'failed');

create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete cascade,
  requested_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  kind public.ai_generation_kind not null,
  status public.ai_generation_status not null,
  provider text not null default 'openai',
  model text not null,
  input_summary text not null,
  output jsonb,
  error_message text,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index ai_generations_retailer_created_idx
  on public.ai_generations (retailer_id, created_at desc);
create index ai_generations_customer_idx
  on public.ai_generations (customer_id, created_at desc)
  where customer_id is not null;

alter table public.ai_generations enable row level security;

create policy "platform staff can read all ai generations"
  on public.ai_generations for select
  using (public.is_platform_staff());

create policy "retailer staff can read their retailer's ai generations"
  on public.ai_generations for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() not in ('workshop_manager', 'worker')
  );

-- Same "verify the caller's own accepted staff membership" shape as
-- clienteling_notes' insert policy — requested_by_staff_id must be the
-- caller's own row, never an arbitrary staff id within the retailer.
-- Direct RLS, no security-definer RPC: a single-table write scoped to
-- the caller's own retailer with no transactional fan-out, the same
-- reasoning ADR-028 gave customer_preferences.
create policy "sales staff and above can record ai generations"
  on public.ai_generations for insert
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
    and (
      requested_by_staff_id is null
      or exists (
        select 1 from public.retailer_staff_members s
        where s.id = requested_by_staff_id
          and s.user_id = auth.uid()
          and s.retailer_id = ai_generations.retailer_id
          and s.accepted_at is not null
          and s.deleted_at is null
      )
    )
  );

grant select, insert on public.ai_generations to authenticated, service_role;
