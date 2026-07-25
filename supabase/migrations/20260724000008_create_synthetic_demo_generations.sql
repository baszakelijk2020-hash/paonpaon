-- Migration: Create synthetic_demo_generations table for synthetic demo generation and role/device previews

create table public.synthetic_demo_generations (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  device text not null,
  config jsonb not null,
  created_at timestamptz not null default now(),
  created_by_user_id uuid references auth.users
);

-- Add index for quick lookup
create index synthetic_demo_generations_role_device_idx on public.synthetic_demo_generations (role, device);

-- Enable row level security
alter table public.synthetic_demo_generations enable row level security;

-- Policy: platform staff can view
create policy "platform staff can view synthetic demo generations"
  on public.synthetic_demo_generations for select
  using (public.is_platform_staff());

-- Policy: platform staff can insert (with check)
create policy "platform staff can insert synthetic demo generations"
  on public.synthetic_demo_generations for insert
  with check (public.is_platform_staff());

-- Policy: platform staff can update
create policy "platform staff can update synthetic demo generations"
  on public.synthetic_demo_generations for update
  using (public.is_platform_staff());

-- Policy: platform staff can delete
create policy "platform staff can delete synthetic demo generations"
  on public.synthetic_demo_generations for delete
  using (public.is_platform_staff());