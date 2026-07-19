create table public.clienteling_notes (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  author_staff_id uuid not null references public.retailer_staff_members(id),
  body text not null check (char_length(body) between 1 and 5000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index clienteling_notes_customer_idx on public.clienteling_notes(customer_id, pinned desc, created_at desc);
create trigger set_clienteling_notes_updated_at before update on public.clienteling_notes for each row execute function public.set_updated_at();
alter table public.clienteling_notes enable row level security;
create policy "platform reads clienteling notes" on public.clienteling_notes for select using (public.is_platform_staff());
create policy "retailer staff read clienteling notes" on public.clienteling_notes for select using (retailer_id = public.current_retailer_id() and public.current_retailer_role() not in ('workshop_manager','worker'));
create policy "sales staff create clienteling notes" on public.clienteling_notes for insert with check (retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('sales_associate','manager','admin','owner') and exists (select 1 from public.retailer_staff_members s where s.id = author_staff_id and s.user_id = auth.uid() and s.retailer_id = clienteling_notes.retailer_id and s.accepted_at is not null and s.deleted_at is null));
create policy "authors and managers update clienteling notes" on public.clienteling_notes for update using (retailer_id = public.current_retailer_id() and (exists (select 1 from public.retailer_staff_members s where s.id = author_staff_id and s.user_id = auth.uid()) or public.current_retailer_role() in ('manager','admin','owner'))) with check (retailer_id = public.current_retailer_id());
grant select, insert, update on public.clienteling_notes to authenticated, service_role;
