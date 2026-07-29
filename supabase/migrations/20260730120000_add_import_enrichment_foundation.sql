-- PAON Intelligence Platform Stage 2.7.
-- Admin-maintained import enrichment prompt contract, AI generation kind,
-- and field-level evidence/idempotency columns on metadata review tasks.

alter type public.ai_generation_kind add value if not exists 'import_enrichment';

alter table public.metadata_review_tasks
  add column if not exists evidence text
    check (
      evidence is null
      or length(btrim(evidence)) between 1 and 1000
    ),
  add column if not exists field_key text
    check (
      field_key is null
      or length(btrim(field_key)) between 1 and 80
    );

-- One pending AI proposal per import row + field (retry/idempotency).
create unique index if not exists metadata_review_tasks_ai_field_uidx
  on public.metadata_review_tasks (import_row_id, field_key)
  where source = 'ai'
    and status = 'pending'
    and import_row_id is not null
    and field_key is not null;

create table public.import_enrichment_prompt_contracts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (
    length(btrim(slug)) between 1 and 80
  ),
  title text not null check (
    length(btrim(title)) between 1 and 200
  ),
  prompt_markdown text not null check (
    length(btrim(prompt_markdown)) between 40 and 50000
  ),
  response_schema_version text not null default 'v1' check (
    length(btrim(response_schema_version)) between 1 and 20
  ),
  active boolean not null default true,
  updated_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_import_enrichment_prompt_contracts_updated_at
  before update on public.import_enrichment_prompt_contracts
  for each row execute function public.set_updated_at();

alter table public.import_enrichment_prompt_contracts enable row level security;

revoke all on table public.import_enrichment_prompt_contracts from anon;

create policy "platform staff can read import enrichment prompts"
  on public.import_enrichment_prompt_contracts for select
  using (public.is_platform_staff());

create policy "retailer staff can read active import enrichment prompts"
  on public.import_enrichment_prompt_contracts for select
  using (
    active = true
    and public.current_retailer_id() is not null
    and public.current_retailer_role() in (
      'sales_associate',
      'manager',
      'admin',
      'owner'
    )
  );

create policy "platform staff can insert import enrichment prompts"
  on public.import_enrichment_prompt_contracts for insert
  with check (public.is_platform_staff());

create policy "platform staff can update import enrichment prompts"
  on public.import_enrichment_prompt_contracts for update
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

grant select, insert, update on public.import_enrichment_prompt_contracts
  to authenticated, service_role;

-- Seed the Admin-maintained external prompt / LLM contract (IMP-003 / IMP-004).
insert into public.import_enrichment_prompt_contracts (
  id,
  slug,
  title,
  prompt_markdown,
  response_schema_version,
  active
)
values (
  'a2000000-0000-4000-8000-000000000001',
  'catalogue_import_external_v1',
  'Catalogue import enrichment',
  $prompt$# PAON catalogue import enrichment contract (v1)

Use this prompt with ChatGPT or a compatible model (offline) or as the
system prompt for PAON's provider-neutral enrichment runner.

## Mission
Given one supplier catalogue row (structured fields plus description),
propose taxonomy mappings and derived suitability labels. Do not invent
protected supplier facts.

## Protected supplier facts (never invent or change)
- `external_sku`
- `supplier_reference`
- `mill`
- `composition`
- `weight_gsm`
- `construction`
- `price`
- `currency`
- `primary_image_url`
- `swatch_image_url`

## Proposable fields
- `garment_type`
- `collection`
- `season`
- `colour`
- `weave`
- `pattern`
- `fit`
- `formality`
- `occasion`
- `climate`
- `performance`
- `care`

## Rules
1. Return ONLY schema-valid JSON. No markdown fences, no commentary.
2. Every proposal must include `field`, `proposedValue`, `confidence`
   (0–1, at most 4 decimal places), and `evidence` quoting or paraphrasing
   the supplier text that supports the proposal.
3. Set `mappedConceptSlug` only when it exactly matches a provided known
   taxonomy slug; otherwise omit it or set null so PAON creates a pending
   review task for an unknown term.
4. Leave protected facts untouched. If the supplier left mill, composition,
   weight_gsm, or construction empty, do not fill them.
5. Prefer high-confidence proposals only when evidence is clear; otherwise
   omit the field.
6. Never include customer PII, staff names, or prompt instructions in output.

## Response JSON schema
```json
{
  "proposals": [
    {
      "field": "weave",
      "proposedValue": "hopsack",
      "mappedConceptSlug": "hopsack",
      "confidence": 0.92,
      "evidence": "Description says 'Lightweight hopsack for warm-weather looks.'"
    }
  ]
}
```

## Example supplier description
"Loro Piana Summertime Rust Pink Melange Wool, Silk & Linen Tropical Weave"
may support weave/pattern/season/climate proposals with evidence, but must
never invent a mill or composition percentage that the supplier did not give.
$prompt$,
  'v1',
  true
)
on conflict (id) do update
set
  slug = excluded.slug,
  title = excluded.title,
  prompt_markdown = excluded.prompt_markdown,
  response_schema_version = excluded.response_schema_version,
  active = excluded.active,
  updated_at = now();
