-- Migration: Create prospect_demo_previews table for role/device previews

create table public.prospect_demo_previews (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null
    references public.prospect_demo_environments(id) on delete cascade,
  role text not null,
  device text not null,
  preview_data jsonb not null,
  created_at timestamptz not null default now()
);

-- Add index for quick lookup by environment, role, device
create index prospect_demo_previews_env_role_device_idx on public.prospect_demo_previews (environment_id, role, device);

-- Enable row level security
alter table public.prospect_demo_previews enable row level security;

-- Policy: platform staff can view
create policy "platform staff can view prospect demo previews"
  on public.prospect_demo_previews for select
  using (public.is_platform_staff());

-- Policy: platform staff can insert
create policy "platform staff can insert prospect demo previews"
  on public.prospect_demo_previews for insert
  with check (public.is_platform_staff());

-- Policy: platform staff can update
create policy "platform staff can update prospect demo previews"
  on public.prospect_demo_previews for update
  using (public.is_platform_staff());

-- Policy: platform staff can delete
create policy "platform staff can delete prospect demo previews"
  on public.prospect_demo_previews for delete
  using (public.is_platform_staff());