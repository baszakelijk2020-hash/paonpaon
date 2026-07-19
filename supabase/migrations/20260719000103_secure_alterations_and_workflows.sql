create or replace function public.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.retailer_staff_members
  where user_id = auth.uid() and accepted_at is not null and deleted_at is null
  limit 1
$$;

create or replace function public.current_workshop_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workshop_id
  from public.retailer_staff_members
  where user_id = auth.uid() and accepted_at is not null and deleted_at is null
  limit 1
$$;

create or replace function public.enforce_retailer_staff_workshop_scope()
returns trigger
language plpgsql
as $$
begin
  if new.workshop_id is not null and not exists (
    select 1 from public.workshops w
    where w.id = new.workshop_id and w.retailer_id = new.retailer_id
  ) then raise exception 'Staff workshop must belong to the staff retailer'; end if;
  return new;
end;
$$;

create trigger enforce_retailer_staff_workshop_scope_on_write
  before insert or update on public.retailer_staff_members
  for each row execute function public.enforce_retailer_staff_workshop_scope();

create or replace function public.is_alterations_management()
returns boolean
language sql
stable
as $$
  select public.current_staff_id() is not null
    and public.current_retailer_role() in ('owner', 'admin', 'manager')
$$;

create or replace function public.is_alterations_advisor()
returns boolean
language sql
stable
as $$
  select public.current_staff_id() is not null
    and public.current_retailer_role() in ('owner', 'admin', 'manager', 'sales_associate')
$$;

create or replace function public.can_access_alteration_work_order(p_alteration_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.role() = 'service_role' or public.is_platform_staff() or exists (
    select 1
    from public.alteration_work_orders w
    where w.id = p_alteration_id
      and w.retailer_id = public.current_retailer_id()
      and public.current_staff_id() is not null
      and (
        public.current_retailer_role() in ('owner', 'admin', 'manager', 'sales_associate', 'production_staff')
        or (
          public.current_retailer_role() = 'workshop_manager'
          and exists (
            select 1 from public.work_order_assignments a
            where a.alteration_id = w.id
              and a.workshop_id = public.current_workshop_id()
              and a.active
          )
        )
        or (
          public.current_retailer_role() = 'worker'
          and (
            exists (
              select 1 from public.work_order_assignments a
              where a.alteration_id = w.id
                and a.assigned_worker_id = public.current_staff_id()
                and a.active
            )
            or exists (
              select 1 from public.alteration_tasks t
              where t.alteration_id = w.id
                and t.assigned_worker_id = public.current_staff_id()
                and t.deleted_at is null
            )
          )
        )
      )
  )
$$;

-- Workshop identities share the Retailer Portal login machinery but must not
-- inherit the broad tenant reads/writes granted to in-house retailer roles by
-- earlier migrations. Restrictive policies narrow those existing permissive
-- policies without rewriting migration history.
create policy "workshop roles cannot read customer records"
  on public.customers as restrictive for select
  using (
    coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true)
  );
create policy "workshop roles cannot insert customer records"
  on public.customers as restrictive for insert
  with check (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot update customer records"
  on public.customers as restrictive for update
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true))
  with check (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot delete customer records"
  on public.customers as restrictive for delete
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));

create policy "workshop roles only read necessary staff"
  on public.retailer_staff_members as restrictive for select
  using (
    coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true)
    or user_id = auth.uid()
    or (
      public.current_retailer_role() = 'workshop_manager'
      and workshop_id = public.current_workshop_id()
    )
  );

create policy "workshop roles cannot read commerce orders"
  on public.orders as restrictive for select
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot update commerce orders"
  on public.orders as restrictive for update
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true))
  with check (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot read order lines"
  on public.order_lines as restrictive for select
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));

create policy "workshop roles cannot read appointments"
  on public.appointments as restrictive for select
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot insert appointments"
  on public.appointments as restrictive for insert
  with check (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot update appointments"
  on public.appointments as restrictive for update
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true))
  with check (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot read availability"
  on public.availability_windows as restrictive for select
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot insert availability"
  on public.availability_windows as restrictive for insert
  with check (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot update availability"
  on public.availability_windows as restrictive for update
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true))
  with check (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot delete availability"
  on public.availability_windows as restrictive for delete
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));

create policy "workshop roles cannot read collections"
  on public.collections as restrictive for select
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot read products"
  on public.products as restrictive for select
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot read product variants"
  on public.product_variants as restrictive for select
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));

create or replace function public.can_access_physical_garment(p_garment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_staff() or exists (
    select 1 from public.physical_garments g
    where g.id = p_garment_id
      and g.retailer_id = public.current_retailer_id()
      and (
        public.current_retailer_role() in ('owner', 'admin', 'manager', 'sales_associate', 'production_staff')
        or exists (
          select 1 from public.alteration_work_orders w
          where w.physical_garment_id = g.id
            and public.can_access_alteration_work_order(w.id)
        )
      )
  )
$$;

alter table public.workshops enable row level security;
alter table public.alteration_catalogue_categories enable row level security;
alter table public.alteration_operations enable row level security;
alter table public.retailer_alteration_category_settings enable row level security;
alter table public.retailer_alteration_operation_settings enable row level security;
alter table public.alteration_price_lists enable row level security;
alter table public.alteration_price_list_items enable row level security;
alter table public.physical_garments enable row level security;
alter table public.fitting_sessions enable row level security;
alter table public.fitting_observations enable row level security;
alter table public.alteration_work_orders enable row level security;
alter table public.alteration_tasks enable row level security;
alter table public.alteration_task_notes enable row level security;
alter table public.work_order_assignments enable row level security;
alter table public.alteration_status_history enable row level security;
alter table public.alteration_pricing_history enable row level security;
alter table public.price_change_proposals enable row level security;
alter table public.alteration_attachments enable row level security;
alter table public.chain_of_custody_events enable row level security;
alter table public.completion_reviews enable row level security;
alter table public.alteration_fulfillment_events enable row level security;
alter table public.audit_log_entries enable row level security;

create policy "authenticated users can read alteration catalogue categories"
  on public.alteration_catalogue_categories for select to authenticated
  using (
    active and (
      public.is_platform_staff()
      or (
        public.current_staff_id() is not null
        and public.current_retailer_role() in ('owner','admin','manager','sales_associate','production_staff','workshop_manager')
      )
    )
  );
create policy "authenticated users can read alteration operations"
  on public.alteration_operations for select to authenticated
  using (
    active and (
      public.is_platform_staff()
      or (
        public.current_staff_id() is not null
        and public.current_retailer_role() in ('owner','admin','manager','sales_associate','production_staff','workshop_manager')
      )
    )
  );
create policy "platform staff can manage alteration catalogue categories"
  on public.alteration_catalogue_categories for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "platform staff can manage alteration operations"
  on public.alteration_operations for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());

create policy "retailer staff can read their retailer workshops"
  on public.workshops for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_staff_id() is not null
    and (
      public.current_retailer_role() not in ('workshop_manager','worker')
      or (public.current_retailer_role() = 'workshop_manager' and id = public.current_workshop_id())
    )
  );
create policy "management can manage workshops"
  on public.workshops for all
  using (retailer_id = public.current_retailer_id() and public.is_alterations_management())
  with check (retailer_id = public.current_retailer_id() and public.is_alterations_management());
create policy "platform staff can read workshops"
  on public.workshops for select using (public.is_platform_staff());

create policy "retailer staff can read category settings"
  on public.retailer_alteration_category_settings for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_staff_id() is not null
    and public.current_retailer_role() <> 'worker'
  );
create policy "management can manage category settings"
  on public.retailer_alteration_category_settings for all
  using (retailer_id = public.current_retailer_id() and public.is_alterations_management())
  with check (retailer_id = public.current_retailer_id() and public.is_alterations_management());
create policy "platform staff can read category settings"
  on public.retailer_alteration_category_settings for select using (public.is_platform_staff());

create policy "retailer staff can read operation settings"
  on public.retailer_alteration_operation_settings for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_staff_id() is not null
    and public.current_retailer_role() <> 'worker'
  );
create policy "management can manage operation settings"
  on public.retailer_alteration_operation_settings for all
  using (retailer_id = public.current_retailer_id() and public.is_alterations_management())
  with check (retailer_id = public.current_retailer_id() and public.is_alterations_management());
create policy "platform staff can read operation settings"
  on public.retailer_alteration_operation_settings for select using (public.is_platform_staff());

create policy "authorized staff can read price lists"
  on public.alteration_price_lists for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_staff_id() is not null
    and (
      public.current_retailer_role() in ('owner', 'admin', 'manager', 'sales_associate', 'production_staff')
      or (public.current_retailer_role() = 'workshop_manager' and workshop_id = public.current_workshop_id())
    )
  );
create policy "platform staff can read price lists"
  on public.alteration_price_lists for select using (public.is_platform_staff());

create policy "authorized staff can read price list items"
  on public.alteration_price_list_items for select
  using (exists (select 1 from public.alteration_price_lists p where p.id = price_list_id));
create policy "platform staff can read price list items"
  on public.alteration_price_list_items for select using (public.is_platform_staff());

create or replace function public.enforce_physical_garment_reference_scope()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.customers c
    where c.id = new.customer_id and c.retailer_id = new.retailer_id
  ) then raise exception 'Physical garment customer must belong to its retailer'; end if;
  if not exists (
    select 1 from public.alteration_catalogue_categories c
    where c.code = new.category_code and c.active
  ) then raise exception 'Physical garment category is not active'; end if;
  if new.order_line_id is not null and not exists (
    select 1 from public.order_lines l
    join public.orders o on o.id = l.order_id
    where l.id = new.order_line_id and o.retailer_id = new.retailer_id
  ) then raise exception 'Order line must belong to the garment retailer'; end if;
  return new;
end;
$$;

create trigger enforce_physical_garment_reference_scope_on_write
  before insert or update on public.physical_garments
  for each row execute function public.enforce_physical_garment_reference_scope();

create or replace function public.enforce_fitting_reference_scope()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'fitting_sessions' then
    if not exists (
      select 1 from public.customers c
      where c.id = new.customer_id and c.retailer_id = new.retailer_id
    ) then raise exception 'Fitting customer must belong to its retailer'; end if;
    if new.appointment_id is not null and not exists (
      select 1 from public.appointments a
      where a.id = new.appointment_id and a.retailer_id = new.retailer_id
    ) then raise exception 'Fitting appointment must belong to its retailer'; end if;
  else
    if not exists (
      select 1 from public.fitting_sessions s
      where s.id = new.fitting_session_id and s.retailer_id = new.retailer_id
    ) or not exists (
      select 1 from public.physical_garments g
      where g.id = new.physical_garment_id and g.retailer_id = new.retailer_id
    ) then raise exception 'Observation session and garment must belong to its retailer'; end if;
  end if;
  return new;
end;
$$;

create trigger enforce_fitting_session_reference_scope_on_write
  before insert or update on public.fitting_sessions
  for each row execute function public.enforce_fitting_reference_scope();
create trigger enforce_fitting_observation_reference_scope_on_write
  before insert or update on public.fitting_observations
  for each row execute function public.enforce_fitting_reference_scope();

create or replace function public.enforce_alteration_price_list_scope()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'alteration_price_lists' then
    if new.workshop_id is not null and not exists (
      select 1 from public.workshops w
      where w.id = new.workshop_id and w.retailer_id = new.retailer_id
    ) then raise exception 'Price-list workshop must belong to its retailer'; end if;
  else
    if not exists (
      select 1 from public.alteration_price_lists p
      where p.id = new.price_list_id
        and p.retailer_id = new.retailer_id
        and p.currency = new.currency
    ) then raise exception 'Price-list item must match its list retailer and currency'; end if;
  end if;
  return new;
end;
$$;

create trigger enforce_alteration_price_list_scope_on_write
  before insert or update on public.alteration_price_lists
  for each row execute function public.enforce_alteration_price_list_scope();
create trigger enforce_alteration_price_list_item_scope_on_write
  before insert or update on public.alteration_price_list_items
  for each row execute function public.enforce_alteration_price_list_scope();

create policy "authorized staff can read physical garments"
  on public.physical_garments for select using (
    public.current_retailer_role() <> 'worker'
    and public.can_access_physical_garment(id)
  );
create policy "advisors can record physical garments"
  on public.physical_garments for insert
  with check (retailer_id = public.current_retailer_id() and public.is_alterations_advisor());
create policy "advisors can correct physical garment identification"
  on public.physical_garments for update
  using (retailer_id = public.current_retailer_id() and public.is_alterations_advisor())
  with check (retailer_id = public.current_retailer_id() and public.is_alterations_advisor());
create policy "platform staff can read physical garments"
  on public.physical_garments for select using (public.is_platform_staff());

create policy "authorized staff can read fitting sessions"
  on public.fitting_sessions for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_staff_id() is not null
    and public.current_retailer_role() in ('owner','admin','manager','sales_associate','production_staff')
  );
create policy "advisors can record fitting sessions"
  on public.fitting_sessions for insert
  with check (retailer_id = public.current_retailer_id() and public.is_alterations_advisor());
create policy "platform staff can read fitting sessions"
  on public.fitting_sessions for select using (public.is_platform_staff());

create policy "authorized staff can read fitting observations"
  on public.fitting_observations for select
  using (public.current_retailer_role() <> 'worker' and public.can_access_physical_garment(physical_garment_id));
create policy "advisors can record fitting observations"
  on public.fitting_observations for insert
  with check (retailer_id = public.current_retailer_id() and public.is_alterations_advisor());
create policy "platform staff can read fitting observations"
  on public.fitting_observations for select using (public.is_platform_staff());

create policy "authorized staff can read work orders"
  on public.alteration_work_orders for select using (public.current_retailer_role() <> 'worker' and public.can_access_alteration_work_order(id));
create policy "platform staff can read work orders"
  on public.alteration_work_orders for select using (public.is_platform_staff());

create policy "authorized staff can read alteration tasks"
  on public.alteration_tasks for select using (public.current_retailer_role() <> 'worker' and public.can_access_alteration_work_order(alteration_id));
create policy "platform staff can read alteration tasks"
  on public.alteration_tasks for select using (public.is_platform_staff());

create policy "authorized staff can read alteration task notes"
  on public.alteration_task_notes for select using (
    (public.current_retailer_role() <> 'worker' and public.can_access_alteration_work_order(alteration_id))
    or (public.current_retailer_role() = 'worker' and exists (
      select 1 from public.alteration_tasks t
      where t.id = task_id
        and t.assigned_worker_id = public.current_staff_id()
        and t.classification = 'work_now'
        and t.deleted_at is null
    ))
  );
create policy "platform staff can read alteration task notes"
  on public.alteration_task_notes for select using (public.is_platform_staff());

create policy "authorized staff can read work order assignments"
  on public.work_order_assignments for select using (
    public.current_retailer_role() <> 'worker'
    and public.can_access_alteration_work_order(alteration_id)
  );
create policy "platform staff can read work order assignments"
  on public.work_order_assignments for select using (public.is_platform_staff());

create or replace function public.enforce_work_order_assignment_scope()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.alteration_work_orders w
    where w.id = new.alteration_id and w.retailer_id = new.retailer_id
  ) or not exists (
    select 1 from public.workshops w
    where w.id = new.workshop_id and w.retailer_id = new.retailer_id
  ) then raise exception 'Assignment order and workshop must belong to its retailer'; end if;
  if new.assigned_worker_id is not null and not exists (
    select 1 from public.retailer_staff_members s
    where s.id = new.assigned_worker_id
      and s.retailer_id = new.retailer_id
      and s.workshop_id = new.workshop_id
      and s.role = 'worker'
      and s.accepted_at is not null
      and s.deleted_at is null
  ) then
    raise exception 'Assigned worker must be an active worker in the assigned workshop';
  end if;
  if tg_op = 'UPDATE' and public.current_retailer_role() = 'workshop_manager'
    and (
      new.alteration_id is distinct from old.alteration_id
      or new.retailer_id is distinct from old.retailer_id
      or new.workshop_id is distinct from old.workshop_id
      or new.assigned_by_staff_id is distinct from old.assigned_by_staff_id
      or new.active is distinct from old.active
    )
  then
    raise exception 'Workshop managers may only update the assigned worker and target completion date';
  end if;
  return new;
end;
$$;

create trigger enforce_work_order_assignment_scope_on_write
  before insert or update on public.work_order_assignments
  for each row execute function public.enforce_work_order_assignment_scope();

create policy "authorized staff can read alteration status history"
  on public.alteration_status_history for select using (public.current_retailer_role() <> 'worker' and public.can_access_alteration_work_order(alteration_id));
create policy "platform staff can read alteration status history"
  on public.alteration_status_history for select using (public.is_platform_staff());
create policy "authorized staff can read alteration pricing history"
  on public.alteration_pricing_history for select using (public.current_retailer_role() <> 'worker' and public.can_access_alteration_work_order(alteration_id));
create policy "platform staff can read alteration pricing history"
  on public.alteration_pricing_history for select using (public.is_platform_staff());

create policy "authorized staff can read price proposals"
  on public.price_change_proposals for select using (public.current_retailer_role() <> 'worker' and public.can_access_alteration_work_order(alteration_id));
create policy "platform staff can read price proposals"
  on public.price_change_proposals for select using (public.is_platform_staff());

create policy "authorized staff can read alteration attachments"
  on public.alteration_attachments for select
  using (
    (alteration_id is not null and public.can_access_alteration_work_order(alteration_id))
    or (physical_garment_id is not null and public.can_access_physical_garment(physical_garment_id))
    or (task_id is not null and exists (select 1 from public.alteration_tasks t where t.id = task_id and public.can_access_alteration_work_order(t.alteration_id)))
  );
create policy "authorized staff can add alteration attachment metadata"
  on public.alteration_attachments for insert
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() <> 'read_only'
    and (
      (alteration_id is not null and public.can_access_alteration_work_order(alteration_id))
      or (physical_garment_id is not null and public.can_access_physical_garment(physical_garment_id))
    )
  );
create policy "platform staff can read alteration attachments"
  on public.alteration_attachments for select using (public.is_platform_staff());

create or replace function public.enforce_alteration_attachment_scope()
returns trigger
language plpgsql
as $$
begin
  if new.storage_bucket <> 'alteration-evidence' then
    raise exception 'Alteration attachments must use the private evidence bucket';
  end if;
  if new.alteration_id is null then
    raise exception 'Alteration attachments must identify their work order';
  end if;
  if new.storage_path not like (new.retailer_id::text || '/' || new.alteration_id::text || '/%') then
    raise exception 'Attachment path must be scoped to its retailer and work order';
  end if;
  if new.alteration_id is not null and not exists (
    select 1 from public.alteration_work_orders w
    where w.id = new.alteration_id and w.retailer_id = new.retailer_id
  ) then raise exception 'Attachment work order must belong to its retailer'; end if;
  if new.task_id is not null and not exists (
    select 1 from public.alteration_tasks t
    where t.id = new.task_id and t.retailer_id = new.retailer_id
      and (new.alteration_id is null or t.alteration_id = new.alteration_id)
  ) then raise exception 'Attachment task must belong to its work order and retailer'; end if;
  if new.observation_id is not null and not exists (
    select 1 from public.fitting_observations o
    where o.id = new.observation_id and o.retailer_id = new.retailer_id
  ) then raise exception 'Attachment observation must belong to its retailer'; end if;
  if new.proposal_id is not null and not exists (
    select 1 from public.price_change_proposals p
    where p.id = new.proposal_id and p.retailer_id = new.retailer_id
      and (new.alteration_id is null or p.alteration_id = new.alteration_id)
  ) then raise exception 'Attachment proposal must belong to its work order and retailer'; end if;
  if new.physical_garment_id is not null and not exists (
    select 1 from public.physical_garments g
    where g.id = new.physical_garment_id and g.retailer_id = new.retailer_id
  ) then raise exception 'Attachment garment must belong to its retailer'; end if;
  return new;
end;
$$;

create trigger enforce_alteration_attachment_scope_on_write
  before insert or update on public.alteration_attachments
  for each row execute function public.enforce_alteration_attachment_scope();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'alteration-evidence',
  'alteration-evidence',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

create or replace function public.can_access_alteration_storage_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  v_folders text[] := storage.foldername(p_name);
  v_alteration_id uuid;
begin
  if public.is_platform_staff() then return true; end if;
  if array_length(v_folders, 1) < 2
    or v_folders[1] <> public.current_retailer_id()::text
  then return false; end if;
  begin
    v_alteration_id := v_folders[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return public.can_access_alteration_work_order(v_alteration_id);
end;
$$;

create policy "authorized alteration staff can read evidence objects"
  on storage.objects for select
  using (bucket_id = 'alteration-evidence' and public.can_access_alteration_storage_object(name));
create policy "authorized alteration staff can upload evidence objects"
  on storage.objects for insert
  with check (
    bucket_id = 'alteration-evidence'
    and public.current_retailer_role() <> 'read_only'
    and public.can_access_alteration_storage_object(name)
  );
create policy "uploaders can remove unregistered evidence objects"
  on storage.objects for delete
  using (
    bucket_id = 'alteration-evidence'
    and public.can_access_alteration_storage_object(name)
    and not exists (
      select 1 from public.alteration_attachments a
      where a.storage_bucket = bucket_id and a.storage_path = name
    )
  );

create policy "authorized staff can read custody events"
  on public.chain_of_custody_events for select using (public.current_retailer_role() <> 'worker' and public.can_access_alteration_work_order(alteration_id));
create policy "authorized staff can record custody events"
  on public.chain_of_custody_events for insert
  with check (
    retailer_id = public.current_retailer_id()
    and public.can_access_alteration_work_order(alteration_id)
    and (
      (public.current_retailer_role() in ('owner','admin','manager','sales_associate','production_staff')
        and event_type in ('received','handed_to_workshop','returned_to_retailer','released_to_customer','delivery_dispatch','delivery_complete'))
      or (public.current_retailer_role() = 'workshop_manager'
        and event_type in ('handed_to_workshop','returned_to_retailer'))
    )
  );
create policy "platform staff can read custody events"
  on public.chain_of_custody_events for select using (public.is_platform_staff());

create policy "authorized staff can read completion reviews"
  on public.completion_reviews for select using (public.current_retailer_role() <> 'worker' and public.can_access_alteration_work_order(alteration_id));
create policy "platform staff can read completion reviews"
  on public.completion_reviews for select using (public.is_platform_staff());

create policy "authorized staff can read fulfillment events"
  on public.alteration_fulfillment_events for select using (public.current_retailer_role() <> 'worker' and public.can_access_alteration_work_order(alteration_id));
create policy "retailer oversight can record fulfillment events"
  on public.alteration_fulfillment_events for insert
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_staff_id() is not null
    and public.current_retailer_role() in ('owner','admin','manager','sales_associate','production_staff')
  );
create policy "platform staff can read fulfillment events"
  on public.alteration_fulfillment_events for select using (public.is_platform_staff());

create policy "retailer management can read their audit log"
  on public.audit_log_entries for select
  using (retailer_id = public.current_retailer_id() and public.is_alterations_management());
create policy "platform staff can read all audit logs"
  on public.audit_log_entries for select using (public.is_platform_staff());

create or replace function public.is_valid_alteration_transition(
  p_from public.alteration_work_order_status,
  p_to public.alteration_work_order_status
)
returns boolean
language sql
immutable
as $$
  select case p_from
    when 'intake' then p_to in ('quoted', 'canceled')
    when 'quoted' then p_to in ('awaiting_approval', 'approved', 'canceled')
    when 'awaiting_approval' then p_to in ('approved', 'canceled')
    when 'approved' then p_to in ('assigned', 'canceled')
    when 'assigned' then p_to in ('in_progress', 'canceled')
    when 'in_progress' then p_to in ('completion_review', 'canceled')
    when 'completion_review' then p_to in ('in_progress', 'ready_for_pickup', 'out_for_delivery', 'canceled')
    when 'ready_for_pickup' then p_to in ('completed', 'canceled')
    when 'out_for_delivery' then p_to in ('completed', 'canceled')
    else false
  end
$$;

create or replace function public.enforce_work_order_status_via_history()
returns trigger
language plpgsql
as $$
begin
  if new.original_quote_amount_minor_units is distinct from old.original_quote_amount_minor_units
    or new.original_quote_currency is distinct from old.original_quote_currency
  then
    raise exception 'The original work-order quote is immutable';
  end if;
  if auth.role() = 'service_role' or current_user <> session_user or public.is_platform_staff() then
    return new;
  end if;
  if new.status is distinct from old.status
    or new.agreed_total_amount_minor_units is distinct from old.agreed_total_amount_minor_units
    or new.agreed_total_currency is distinct from old.agreed_total_currency
    or new.canceled_at is distinct from old.canceled_at
    or new.cancellation_reason is distinct from old.cancellation_reason
  then
    raise exception 'Work-order status and agreed pricing may only change through validated workflow functions';
  end if;
  return new;
end;
$$;

create trigger enforce_work_order_status_via_history_on_update
  before update on public.alteration_work_orders
  for each row execute function public.enforce_work_order_status_via_history();

create or replace function public.enforce_alteration_task_immutable_scope()
returns trigger
language plpgsql
as $$
begin
  if new.alteration_id is distinct from old.alteration_id
    or new.retailer_id is distinct from old.retailer_id
    or new.operation_id is distinct from old.operation_id
    or new.title is distinct from old.title
    or new.instructions is distinct from old.instructions
    or new.classification is distinct from old.classification
    or new.original_quote_amount_minor_units is distinct from old.original_quote_amount_minor_units
    or new.original_quote_currency is distinct from old.original_quote_currency
  then
    raise exception 'Alteration task scope and original quote are immutable';
  end if;
  return new;
end;
$$;

create trigger enforce_alteration_task_immutable_scope_on_update
  before update on public.alteration_tasks
  for each row execute function public.enforce_alteration_task_immutable_scope();

create or replace function public.enforce_alteration_custody_workflow()
returns trigger
language plpgsql
as $$
declare
  v_order public.alteration_work_orders%rowtype;
  v_last_event public.custody_event_type;
begin
  select * into v_order
  from public.alteration_work_orders
  where id = new.alteration_id and deleted_at is null;
  if v_order.id is null or v_order.retailer_id <> new.retailer_id then
    raise exception 'Custody event must belong to the work order retailer';
  end if;
  select event_type into v_last_event
  from public.chain_of_custody_events
  where alteration_id = new.alteration_id
  order by occurred_at desc, id desc
  limit 1;
  if new.event_type = 'received' and v_order.status <> 'intake' then
    raise exception 'Garments may only be received during intake';
  elsif new.event_type = 'received' and v_last_event is not null then
    raise exception 'Garment receipt has already been recorded';
  elsif new.event_type = 'handed_to_workshop' and v_order.status not in ('assigned','in_progress') then
    raise exception 'Garment handoff to workshop requires assigned work';
  elsif new.event_type = 'handed_to_workshop' and (
    v_last_event is null or v_last_event not in ('received','returned_to_retailer')
  ) then
    raise exception 'Workshop handoff must follow retailer custody';
  elsif new.event_type = 'returned_to_retailer' and v_order.status not in ('in_progress','completion_review') then
    raise exception 'Workshop return requires work in progress or completion review';
  elsif new.event_type = 'returned_to_retailer' and v_last_event is distinct from 'handed_to_workshop' then
    raise exception 'Workshop return must follow a workshop handoff';
  elsif new.event_type = 'released_to_customer' and v_order.status <> 'ready_for_pickup' then
    raise exception 'Customer release requires ready-for-pickup status';
  elsif new.event_type = 'released_to_customer' and (
    v_last_event is null or v_last_event not in ('received','returned_to_retailer')
  ) then
    raise exception 'Customer release requires retailer custody';
  elsif new.event_type in ('delivery_dispatch','delivery_complete') and v_order.status <> 'out_for_delivery' then
    raise exception 'Delivery custody events require out-for-delivery status';
  elsif new.event_type = 'delivery_dispatch' and (
    v_last_event is null or v_last_event not in ('received','returned_to_retailer')
  ) then
    raise exception 'Delivery dispatch requires retailer custody';
  elsif new.event_type = 'delivery_complete' and v_last_event is distinct from 'delivery_dispatch' then
    raise exception 'Delivery completion must follow dispatch';
  end if;
  if new.event_type in ('released_to_customer','delivery_complete')
    and nullif(trim(new.to_party), '') is null
  then raise exception 'Release recipient is required'; end if;
  return new;
end;
$$;

create trigger enforce_alteration_custody_workflow_on_insert
  before insert on public.chain_of_custody_events
  for each row execute function public.enforce_alteration_custody_workflow();

create or replace function public.enforce_alteration_fulfillment_workflow()
returns trigger
language plpgsql
as $$
declare
  v_order public.alteration_work_orders%rowtype;
begin
  select * into v_order
  from public.alteration_work_orders
  where id = new.alteration_id and deleted_at is null;
  if v_order.id is null or v_order.retailer_id <> new.retailer_id then
    raise exception 'Fulfillment event must belong to the work order retailer';
  end if;
  if new.method = 'pickup' and new.status in ('ready','completed')
    and v_order.status <> 'ready_for_pickup'
  then raise exception 'Pickup readiness and completion require ready-for-pickup status'; end if;
  if new.method = 'delivery' and new.status in ('dispatched','completed')
    and v_order.status <> 'out_for_delivery'
  then raise exception 'Delivery dispatch and completion require out-for-delivery status'; end if;
  if new.status = 'dispatched' and new.method <> 'delivery' then
    raise exception 'Only delivery fulfillment can be dispatched';
  end if;
  if new.method = 'delivery' and new.status <> 'canceled'
    and new.delivery_address is null
  then raise exception 'Delivery fulfillment requires an address'; end if;
  if new.method = 'pickup' and new.delivery_address is not null then
    raise exception 'Pickup fulfillment cannot carry a delivery address';
  end if;
  if new.status = 'completed' and (
    nullif(trim(new.released_to_name), '') is null
    or nullif(trim(new.verification_note), '') is null
  ) then raise exception 'Completed fulfillment requires recipient and verification'; end if;
  return new;
end;
$$;

create trigger enforce_alteration_fulfillment_workflow_on_insert
  before insert on public.alteration_fulfillment_events
  for each row execute function public.enforce_alteration_fulfillment_workflow();

create or replace function public.audit_alteration_sensitive_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_retailer_id uuid := (v_row ->> 'retailer_id')::uuid;
  v_entity_id uuid := (v_row ->> 'id')::uuid;
begin
  insert into public.audit_log_entries (
    retailer_id, actor_user_id, actor_staff_id, action, entity_type,
    entity_id, before_state, after_state
  ) values (
    v_retailer_id, auth.uid(), public.current_staff_id(),
    lower(tg_op), tg_table_name, v_entity_id,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_work_order_changes after insert or update on public.alteration_work_orders for each row execute function public.audit_alteration_sensitive_change();
create trigger audit_retailer_staff_changes after insert or update on public.retailer_staff_members for each row execute function public.audit_alteration_sensitive_change();
create trigger audit_workshop_changes after insert or update on public.workshops for each row execute function public.audit_alteration_sensitive_change();
create trigger audit_task_changes after insert or update on public.alteration_tasks for each row execute function public.audit_alteration_sensitive_change();
create trigger audit_task_notes after insert on public.alteration_task_notes for each row execute function public.audit_alteration_sensitive_change();
create trigger audit_work_order_assignments after insert or update on public.work_order_assignments for each row execute function public.audit_alteration_sensitive_change();
create trigger audit_price_proposals after insert or update on public.price_change_proposals for each row execute function public.audit_alteration_sensitive_change();
create trigger audit_attachment_metadata after insert on public.alteration_attachments for each row execute function public.audit_alteration_sensitive_change();
create trigger audit_custody_events after insert on public.chain_of_custody_events for each row execute function public.audit_alteration_sensitive_change();
create trigger audit_completion_reviews after insert or update on public.completion_reviews for each row execute function public.audit_alteration_sensitive_change();
create trigger audit_fulfillment_events after insert or update on public.alteration_fulfillment_events for each row execute function public.audit_alteration_sensitive_change();

create or replace function public.audit_alteration_setting_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_id uuid := coalesce(
    (to_jsonb(new) ->> 'category_id')::uuid,
    (to_jsonb(new) ->> 'operation_id')::uuid
  );
begin
  insert into public.audit_log_entries (
    retailer_id, actor_user_id, actor_staff_id, action, entity_type,
    entity_id, before_state, after_state
  ) values (
    new.retailer_id, auth.uid(), public.current_staff_id(), lower(tg_op),
    tg_table_name, v_entity_id,
    case when tg_op = 'UPDATE' then to_jsonb(old) end,
    to_jsonb(new)
  );
  return new;
end;
$$;

create trigger audit_alteration_category_settings
  after insert or update on public.retailer_alteration_category_settings
  for each row execute function public.audit_alteration_setting_change();
create trigger audit_alteration_operation_settings
  after insert or update on public.retailer_alteration_operation_settings
  for each row execute function public.audit_alteration_setting_change();

create or replace function public.create_alteration_intake(
  p_customer_id uuid,
  p_appointment_id uuid,
  p_source_kind public.garment_source_kind,
  p_category_code text,
  p_garment_type text,
  p_brand text,
  p_description text,
  p_identifying_photo_url text,
  p_label_metadata jsonb,
  p_intake_condition text,
  p_external_reference text,
  p_order_line_id uuid,
  p_supplier_order_reference text,
  p_due_date date,
  p_observations jsonb,
  p_tasks jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_retailer_id uuid;
  v_currency text;
  v_staff_id uuid := public.current_staff_id();
  v_garment_id uuid;
  v_session_id uuid;
  v_work_order_id uuid;
  v_price_list_id uuid;
  v_price_list_currency text;
  v_quote bigint := 0;
  v_item jsonb;
  v_operation_id uuid;
  v_operation_name text;
  v_task_quote integer;
begin
  select c.retailer_id, r.default_currency
    into v_retailer_id, v_currency
  from public.customers c
  join public.retailers r on r.id = c.retailer_id
  where c.id = p_customer_id and c.deleted_at is null;

  if v_retailer_id is null then
    raise exception 'Customer not found';
  end if;
  if auth.role() <> 'service_role' and (
    public.is_platform_staff()
    or v_retailer_id <> public.current_retailer_id()
    or not public.is_alterations_advisor()
  )
  then
    raise exception 'Not authorized to create an alteration intake';
  end if;
  if p_appointment_id is not null and not exists (
    select 1 from public.appointments a
    where a.id = p_appointment_id
      and a.customer_id = p_customer_id
      and a.retailer_id = v_retailer_id
      and a.deleted_at is null
  ) then raise exception 'Fitting appointment does not belong to this customer'; end if;
  if length(trim(coalesce(p_garment_type, ''))) not between 2 and 120
    or length(trim(coalesce(p_description, ''))) not between 2 and 1000
    or length(trim(coalesce(p_intake_condition, ''))) not between 2 and 1000
  then raise exception 'Garment identification and condition are incomplete'; end if;
  if length(coalesce(p_brand, '')) > 120
    or length(coalesce(p_external_reference, '')) > 160
    or length(coalesce(p_supplier_order_reference, '')) > 160
  then raise exception 'Garment reference is too long'; end if;
  if p_label_metadata is not null and jsonb_typeof(p_label_metadata) <> 'object' then
    raise exception 'Label metadata must be a JSON object';
  end if;
  if not exists (
    select 1 from public.alteration_catalogue_categories c
    left join public.retailer_alteration_category_settings s
      on s.category_id = c.id and s.retailer_id = v_retailer_id
    where c.code = p_category_code and c.active and coalesce(s.enabled, true)
  ) then
    raise exception 'Garment category is not enabled';
  end if;
  if p_source_kind = 'finished_mtm' and p_order_line_id is null and nullif(trim(p_supplier_order_reference), '') is null then
    raise exception 'Finished MTM intake requires a PAON order line or supplier/order reference';
  end if;
  if p_order_line_id is not null and not exists (
    select 1 from public.order_lines l
    join public.orders o on o.id = l.order_id
    where l.id = p_order_line_id and o.customer_id = p_customer_id and o.retailer_id = v_retailer_id
  ) then
    raise exception 'PAON order line does not belong to this customer';
  end if;
  if p_tasks is null or jsonb_typeof(p_tasks) <> 'array' then
    raise exception 'Tasks must be a JSON array';
  end if;
  if jsonb_array_length(p_tasks) not between 1 and 30
    or not exists (select 1 from jsonb_array_elements(p_tasks) x where x ->> 'classification' = 'work_now')
  then
    raise exception 'At least one work_now task is required';
  end if;
  if p_observations is null or jsonb_typeof(p_observations) <> 'array' then
    raise exception 'Observations must be a JSON array';
  end if;
  if jsonb_array_length(p_observations) not between 1 and 20 then
    raise exception 'At least one garment-specific observation is required';
  end if;

  select id, currency into v_price_list_id, v_price_list_currency
  from public.alteration_price_lists
  where retailer_id = v_retailer_id
    and kind = 'retailer'
    and active and deleted_at is null
    and effective_from <= current_date
    and (effective_until is null or effective_until >= current_date)
  order by effective_from desc, created_at desc
  limit 1;
  if v_price_list_id is not null then v_currency := v_price_list_currency; end if;

  for v_item in select value from jsonb_array_elements(p_tasks)
  loop
    if length(trim(coalesce(v_item ->> 'title', ''))) not between 2 and 160
      or length(coalesce(v_item ->> 'instructions', '')) > 2000
    then raise exception 'Task title or instructions are invalid'; end if;
    v_operation_id := nullif(v_item ->> 'operationId', '')::uuid;
    if v_operation_id is not null and not exists (
      select 1 from public.alteration_operations o
      join public.alteration_catalogue_categories c on c.id = o.category_id
      left join public.retailer_alteration_operation_settings s
        on s.operation_id = o.id and s.retailer_id = v_retailer_id
      where o.id = v_operation_id and c.code = p_category_code
        and o.active and coalesce(s.enabled, true)
    ) then
      raise exception 'Task operation is not enabled for this garment category';
    end if;
    if v_item ->> 'classification' not in ('work_now', 'future_order_note') then
      raise exception 'Invalid task classification';
    end if;
    if v_item ->> 'classification' = 'work_now' then
      select coalesce(i.amount_minor_units, 0) into v_task_quote
      from (select 1) seed
      left join public.alteration_price_list_items i
        on i.price_list_id = v_price_list_id and i.operation_id = v_operation_id;
      v_quote := v_quote + coalesce(v_task_quote, 0);
    end if;
  end loop;
  if v_quote > 2147483647 then raise exception 'Original quote exceeds the supported Money range'; end if;

  insert into public.physical_garments (
    retailer_id, customer_id, source_kind, category_code, garment_type,
    brand, description, identifying_photo_url, label_metadata,
    intake_condition, external_reference, order_line_id,
    supplier_order_reference
  ) values (
    v_retailer_id, p_customer_id, p_source_kind, p_category_code,
    trim(p_garment_type), nullif(trim(p_brand), ''), trim(p_description),
    nullif(trim(p_identifying_photo_url), ''), coalesce(p_label_metadata, '{}'::jsonb),
    trim(p_intake_condition), nullif(trim(p_external_reference), ''),
    p_order_line_id, nullif(trim(p_supplier_order_reference), '')
  ) returning id into v_garment_id;

  insert into public.fitting_sessions (
    retailer_id, customer_id, appointment_id, fitted_by_staff_id, notes
  ) values (
    v_retailer_id, p_customer_id, p_appointment_id, v_staff_id,
    'Alteration intake fitting'
  )
  returning id into v_session_id;

  for v_item in select value from jsonb_array_elements(p_observations)
  loop
    if v_item ->> 'classification' not in ('work_now', 'future_order_note')
      or length(trim(coalesce(v_item ->> 'area', ''))) not between 2 and 120
      or length(trim(coalesce(v_item ->> 'observation', ''))) not between 2 and 2000
    then raise exception 'Fitting observation is invalid'; end if;
    insert into public.fitting_observations (
      retailer_id, fitting_session_id, physical_garment_id, classification,
      area, observation, recorded_by_staff_id
    ) values (
      v_retailer_id, v_session_id, v_garment_id,
      (v_item ->> 'classification')::public.work_classification,
      trim(v_item ->> 'area'), trim(v_item ->> 'observation'), v_staff_id
    );
  end loop;

  insert into public.alteration_work_orders (
    retailer_id, customer_id, physical_garment_id, fitting_session_id,
    original_quote_amount_minor_units, original_quote_currency, due_date
  ) values (
    v_retailer_id, p_customer_id, v_garment_id, v_session_id,
    v_quote, v_currency, p_due_date
  ) returning id into v_work_order_id;

  for v_item in select value from jsonb_array_elements(p_tasks)
  loop
    v_operation_id := nullif(v_item ->> 'operationId', '')::uuid;
    select name into v_operation_name from public.alteration_operations where id = v_operation_id;
    select coalesce(i.amount_minor_units, 0) into v_task_quote
    from (select 1) seed
    left join public.alteration_price_list_items i
      on i.price_list_id = v_price_list_id and i.operation_id = v_operation_id;
    if v_item ->> 'classification' = 'future_order_note' then
      v_task_quote := 0;
    end if;
    insert into public.alteration_tasks (
      alteration_id, retailer_id, operation_id, title, instructions,
      classification, original_quote_amount_minor_units, original_quote_currency
    ) values (
      v_work_order_id, v_retailer_id, v_operation_id,
      coalesce(nullif(trim(v_item ->> 'title'), ''), v_operation_name),
      nullif(trim(v_item ->> 'instructions'), ''),
      (v_item ->> 'classification')::public.work_classification,
      coalesce(v_task_quote, 0), v_currency
    );
  end loop;

  insert into public.alteration_status_history (
    alteration_id, retailer_id, to_status, note, actor_staff_id,
    actor_user_id, customer_visible
  ) values (
    v_work_order_id, v_retailer_id, 'intake', 'Garment received and fitting recorded',
    v_staff_id, auth.uid(), false
  );
  insert into public.alteration_pricing_history (
    alteration_id, retailer_id, event_type, amount_minor_units, currency,
    reason, actor_staff_id
  ) values (
    v_work_order_id, v_retailer_id, 'original_quote', v_quote, v_currency,
    'Effective retailer price list at intake', v_staff_id
  );
  insert into public.chain_of_custody_events (
    alteration_id, retailer_id, event_type, from_party, to_party,
    condition_note, actor_staff_id
  ) values (
    v_work_order_id, v_retailer_id, 'received', 'Customer', 'Retailer',
    p_intake_condition, v_staff_id
  );

  return v_work_order_id;
end;
$$;

revoke all on function public.create_alteration_intake(uuid, uuid, public.garment_source_kind, text, text, text, text, text, jsonb, text, text, uuid, text, date, jsonb, jsonb) from public;
grant execute on function public.create_alteration_intake(uuid, uuid, public.garment_source_kind, text, text, text, text, text, jsonb, text, text, uuid, text, date, jsonb, jsonb) to authenticated, service_role;

create or replace function public.transition_alteration_work_order(
  p_alteration_id uuid,
  p_to_status public.alteration_work_order_status,
  p_note text,
  p_customer_visible boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.alteration_work_orders%rowtype;
  v_role text := public.current_retailer_role();
  v_staff_id uuid := public.current_staff_id();
begin
  select * into v_order from public.alteration_work_orders where id = p_alteration_id and deleted_at is null for update;
  if v_order.id is null then raise exception 'Work order not found'; end if;
  if auth.role() <> 'service_role' and (public.is_platform_staff() or not public.can_access_alteration_work_order(p_alteration_id)) then
    raise exception 'Not authorized for this work order';
  end if;
  if not public.is_valid_alteration_transition(v_order.status, p_to_status) then
    raise exception 'Invalid alteration transition: % to %', v_order.status, p_to_status;
  end if;
  if p_to_status = 'canceled' and length(trim(coalesce(p_note, ''))) < 3 then
    raise exception 'A cancellation reason is required';
  end if;
  if p_to_status = 'assigned' then
    raise exception 'Use assign_alteration_work_order to assign approved work';
  end if;
  if p_to_status = 'approved' and v_role not in ('owner','admin','manager') and auth.role() <> 'service_role' and not public.is_platform_staff() then
    raise exception 'Retailer management approval is required';
  end if;
  if v_role = 'worker' and p_to_status not in ('in_progress','completion_review') then
    raise exception 'Workers may only start assigned work or mark it review-ready';
  end if;
  if v_role = 'workshop_manager' and p_to_status not in ('in_progress','completion_review') then
    raise exception 'Workshop managers may only progress assigned work to retailer review';
  end if;
  if v_role in ('workshop_manager','worker') and p_to_status = 'in_progress'
    and coalesce((
      select latest.event_type is distinct from 'handed_to_workshop'
      from public.chain_of_custody_events latest
      where latest.alteration_id = p_alteration_id
      order by latest.occurred_at desc, latest.id desc
      limit 1
    ), true)
  then raise exception 'Workshop custody is required before work starts'; end if;
  if v_role = 'sales_associate' and (
    v_order.status not in ('intake','quoted','awaiting_approval')
    or p_to_status not in ('quoted','awaiting_approval','canceled')
  ) then raise exception 'Advisors may only progress intake through quote or cancel before work begins'; end if;
  if p_to_status = 'completion_review' and exists (
    select 1 from public.alteration_tasks
    where alteration_id = p_alteration_id
      and classification = 'work_now'
      and status not in ('review_ready','completed')
      and deleted_at is null
  ) then raise exception 'Every work-now task must be review-ready before completion review'; end if;
  if p_to_status = 'completion_review' and exists (
    select 1 from public.price_change_proposals
    where alteration_id = p_alteration_id
      and status = 'pending'
      and deleted_at is null
  ) then raise exception 'Pending price proposals must be decided before completion review'; end if;
  if p_to_status in ('ready_for_pickup','out_for_delivery') and not exists (
    select 1
    from public.chain_of_custody_events c
    where c.id = (
      select latest.id
      from public.chain_of_custody_events latest
      where latest.alteration_id = p_alteration_id
      order by latest.occurred_at desc, latest.id desc
      limit 1
    )
      and c.event_type in ('received','returned_to_retailer')
  ) then raise exception 'Retailer custody is required before release readiness'; end if;
  if p_to_status = 'completed' and not exists (
    select 1 from public.alteration_fulfillment_events f
    where f.alteration_id = p_alteration_id
      and f.status = 'completed'
      and f.deleted_at is null
      and (
        (v_order.status = 'ready_for_pickup' and f.method = 'pickup')
        or (v_order.status = 'out_for_delivery' and f.method = 'delivery')
      )
  ) then raise exception 'Verified pickup or delivery completion is required'; end if;
  if p_to_status = 'completed' and not exists (
    select 1 from public.chain_of_custody_events c
    where c.alteration_id = p_alteration_id
      and (
        (v_order.status = 'ready_for_pickup' and c.event_type = 'released_to_customer')
        or (v_order.status = 'out_for_delivery' and c.event_type = 'delivery_complete')
      )
  ) then raise exception 'Final chain-of-custody release is required'; end if;

  if p_to_status = 'completion_review' then
    insert into public.completion_reviews (alteration_id, retailer_id, status)
    values (p_alteration_id, v_order.retailer_id, 'pending');
  elsif v_order.status = 'completion_review' and p_to_status = 'in_progress' then
    update public.completion_reviews
    set status = 'changes_requested', notes = nullif(trim(p_note), ''),
        reviewed_by_staff_id = v_staff_id, reviewed_at = now()
    where id = (
      select id from public.completion_reviews
      where alteration_id = p_alteration_id and status = 'pending' and deleted_at is null
      order by created_at desc limit 1
    );
    if not found then raise exception 'Pending completion review not found'; end if;
  elsif v_order.status = 'completion_review' and p_to_status in ('ready_for_pickup','out_for_delivery') then
    update public.completion_reviews
    set status = 'approved', notes = nullif(trim(p_note), ''),
        reviewed_by_staff_id = v_staff_id, reviewed_at = now()
    where id = (
      select id from public.completion_reviews
      where alteration_id = p_alteration_id and status = 'pending' and deleted_at is null
      order by created_at desc limit 1
    );
    if not found then raise exception 'Pending completion review not found'; end if;
  end if;

  if p_to_status = 'canceled' then
    insert into public.alteration_pricing_history (
      alteration_id, task_id, retailer_id, event_type, amount_minor_units,
      currency, reason, actor_staff_id
    )
    select
      alteration_id, task_id, retailer_id, 'withdrawal', proposed_amount_minor_units,
      currency, 'Withdrawn because the work order was canceled: ' || trim(p_note),
      v_staff_id
    from public.price_change_proposals
    where alteration_id = p_alteration_id
      and status = 'pending'
      and deleted_at is null;

    update public.price_change_proposals
    set status = 'withdrawn', decided_by_staff_id = v_staff_id,
        decided_at = now(), decision_reason = 'Work order canceled: ' || trim(p_note)
    where alteration_id = p_alteration_id
      and status = 'pending'
      and deleted_at is null;
  end if;

  update public.alteration_work_orders
  set status = p_to_status,
      agreed_total_amount_minor_units = case when p_to_status = 'approved' then coalesce(agreed_total_amount_minor_units, original_quote_amount_minor_units) else agreed_total_amount_minor_units end,
      agreed_total_currency = case when p_to_status = 'approved' then coalesce(agreed_total_currency, original_quote_currency) else agreed_total_currency end,
      customer_notification_ready_at = case when p_to_status in ('ready_for_pickup','out_for_delivery') then coalesce(customer_notification_ready_at, now()) else customer_notification_ready_at end,
      canceled_at = case when p_to_status = 'canceled' then now() else canceled_at end,
      cancellation_reason = case when p_to_status = 'canceled' then nullif(trim(p_note), '') else cancellation_reason end
  where id = p_alteration_id;

  if p_to_status = 'approved' then
    update public.alteration_tasks
    set status = 'approved',
        agreed_price_amount_minor_units = coalesce(agreed_price_amount_minor_units, original_quote_amount_minor_units),
        agreed_price_currency = coalesce(agreed_price_currency, original_quote_currency)
    where alteration_id = p_alteration_id
      and classification = 'work_now'
      and deleted_at is null;
  elsif v_order.status = 'completion_review' and p_to_status in ('ready_for_pickup','out_for_delivery') then
    update public.alteration_tasks
    set status = 'completed'
    where alteration_id = p_alteration_id
      and classification = 'work_now'
      and status = 'review_ready'
      and deleted_at is null;
  elsif p_to_status = 'canceled' then
    update public.alteration_tasks
    set status = 'canceled'
    where alteration_id = p_alteration_id
      and classification = 'work_now'
      and status <> 'completed'
      and deleted_at is null;
  end if;

  insert into public.alteration_status_history (
    alteration_id, retailer_id, from_status, to_status, note,
    actor_staff_id, actor_user_id, customer_visible
  ) values (
    p_alteration_id, v_order.retailer_id, v_order.status, p_to_status,
    nullif(trim(p_note), ''), v_staff_id, auth.uid(),
    p_customer_visible or p_to_status in ('approved','ready_for_pickup','out_for_delivery','completed','canceled')
  );
end;
$$;

revoke all on function public.transition_alteration_work_order(uuid, public.alteration_work_order_status, text, boolean) from public;
grant execute on function public.transition_alteration_work_order(uuid, public.alteration_work_order_status, text, boolean) to authenticated, service_role;

create or replace function public.set_alteration_operation_price(
  p_operation_id uuid,
  p_amount_minor_units integer,
  p_workshop_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_retailer_id uuid := public.current_retailer_id();
  v_currency text;
  v_list_currency text;
  v_list_id uuid;
  v_kind public.alteration_price_list_kind := case
    when p_workshop_id is null then 'retailer'::public.alteration_price_list_kind
    else 'workshop'::public.alteration_price_list_kind
  end;
begin
  if p_amount_minor_units not between 0 and 100000000 then
    raise exception 'Price must be between zero and 1,000,000 major currency units';
  end if;
  if public.is_platform_staff() then raise exception 'Platform access is oversight-only for retailer pricing'; end if;
  if auth.role() <> 'service_role' and not public.is_platform_staff() and (
    v_retailer_id is null
    or (p_workshop_id is null and not public.is_alterations_management())
    or (p_workshop_id is not null and (public.current_retailer_role() <> 'workshop_manager' or p_workshop_id <> public.current_workshop_id()))
  ) then raise exception 'Not authorized to set this price'; end if;
  if not exists (
    select 1
    from public.alteration_operations o
    join public.alteration_catalogue_categories c on c.id = o.category_id
    left join public.retailer_alteration_category_settings cs
      on cs.category_id = c.id and cs.retailer_id = v_retailer_id
    left join public.retailer_alteration_operation_settings os
      on os.operation_id = o.id and os.retailer_id = v_retailer_id
    where o.id = p_operation_id
      and o.active and c.active
      and coalesce(cs.enabled, true)
      and coalesce(os.enabled, true)
  ) then raise exception 'Alteration operation is not enabled'; end if;
  select default_currency into v_currency from public.retailers where id = v_retailer_id;
  select id, currency into v_list_id, v_list_currency from public.alteration_price_lists
  where retailer_id = v_retailer_id and kind = v_kind and workshop_id is not distinct from p_workshop_id
    and active and deleted_at is null and effective_from <= current_date
    and (effective_until is null or effective_until >= current_date)
  order by effective_from desc, created_at desc limit 1;
  if v_list_id is not null then v_currency := v_list_currency; end if;
  if v_list_id is null then
    insert into public.alteration_price_lists (retailer_id, workshop_id, kind, name, currency)
    values (v_retailer_id, p_workshop_id, v_kind, case when p_workshop_id is null then 'Retail price list' else 'Workshop price list' end, v_currency)
    on conflict do nothing
    returning id into v_list_id;
    if v_list_id is null then
      select id into v_list_id
      from public.alteration_price_lists
      where retailer_id = v_retailer_id
        and kind = v_kind
        and workshop_id is not distinct from p_workshop_id
        and effective_from = current_date
        and deleted_at is null;
    end if;
  end if;
  insert into public.alteration_price_list_items (retailer_id, price_list_id, operation_id, amount_minor_units, currency)
  values (v_retailer_id, v_list_id, p_operation_id, p_amount_minor_units, v_currency)
  on conflict (price_list_id, operation_id) do update
    set amount_minor_units = excluded.amount_minor_units, currency = excluded.currency, updated_at = now();
  insert into public.audit_log_entries (retailer_id, actor_user_id, actor_staff_id, action, entity_type, entity_id, after_state)
  values (v_retailer_id, auth.uid(), public.current_staff_id(), 'set_price', 'alteration_operation', p_operation_id,
    jsonb_build_object('price_list_id', v_list_id, 'amount_minor_units', p_amount_minor_units, 'currency', v_currency));
end;
$$;

revoke all on function public.set_alteration_operation_price(uuid, integer, uuid) from public;
grant execute on function public.set_alteration_operation_price(uuid, integer, uuid) to authenticated;

create unique index one_pending_price_change_per_target
  on public.price_change_proposals (
    alteration_id,
    coalesce(task_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'pending' and deleted_at is null;

create or replace function public.propose_alteration_price_change(
  p_alteration_id uuid,
  p_task_id uuid,
  p_proposed_amount_minor_units integer,
  p_explanation text,
  p_evidence_attachment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.alteration_work_orders%rowtype;
  v_original integer;
  v_id uuid;
  v_staff_id uuid := public.current_staff_id();
begin
  select * into v_order from public.alteration_work_orders where id = p_alteration_id and deleted_at is null;
  if v_order.id is null or not public.can_access_alteration_work_order(p_alteration_id) then raise exception 'Work order not found'; end if;
  if public.current_retailer_role() <> 'workshop_manager' and auth.role() <> 'service_role' then
    raise exception 'Only an assigned workshop manager may propose price changes';
  end if;
  if v_order.status not in ('assigned','in_progress') then
    raise exception 'Price changes may only be proposed while assigned work is active';
  end if;
  if length(trim(p_explanation)) < 10 then raise exception 'A substantive explanation is required'; end if;
  if p_proposed_amount_minor_units not between 0 and 100000000 then
    raise exception 'Price must be between zero and 1,000,000 major currency units';
  end if;
  if p_evidence_attachment_id is not null and not exists (
    select 1 from public.alteration_attachments a
    where a.id = p_evidence_attachment_id
      and a.retailer_id = v_order.retailer_id
      and (
        a.alteration_id = p_alteration_id
        or a.physical_garment_id = v_order.physical_garment_id
        or exists (
          select 1 from public.alteration_tasks t
          where t.id = a.task_id and t.alteration_id = p_alteration_id
        )
      )
  ) then raise exception 'Evidence attachment does not belong to this work order'; end if;
  if p_task_id is not null then
    select original_quote_amount_minor_units into v_original from public.alteration_tasks where id = p_task_id and alteration_id = p_alteration_id;
    if v_original is null then raise exception 'Task not found on work order'; end if;
  else
    v_original := v_order.original_quote_amount_minor_units;
  end if;
  insert into public.price_change_proposals (
    alteration_id, task_id, retailer_id, original_amount_minor_units,
    proposed_amount_minor_units, currency, explanation, proposed_by_staff_id,
    evidence_attachment_id
  ) values (
    p_alteration_id, p_task_id, v_order.retailer_id, v_original,
    p_proposed_amount_minor_units, v_order.original_quote_currency,
    trim(p_explanation), v_staff_id, p_evidence_attachment_id
  ) returning id into v_id;
  insert into public.alteration_pricing_history (
    alteration_id, task_id, retailer_id, event_type, amount_minor_units,
    currency, reason, actor_staff_id
  ) values (
    p_alteration_id, p_task_id, v_order.retailer_id, 'proposal',
    p_proposed_amount_minor_units, v_order.original_quote_currency,
    trim(p_explanation), v_staff_id
  );
  return v_id;
end;
$$;

revoke all on function public.propose_alteration_price_change(uuid, uuid, integer, text, uuid) from public;
grant execute on function public.propose_alteration_price_change(uuid, uuid, integer, text, uuid) to authenticated, service_role;

create or replace function public.decide_alteration_price_change(
  p_proposal_id uuid,
  p_decision public.price_change_proposal_status,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.price_change_proposals%rowtype;
  v_total integer;
  v_staff_id uuid := public.current_staff_id();
begin
  select * into v_proposal from public.price_change_proposals where id = p_proposal_id and deleted_at is null for update;
  if v_proposal.id is null or v_proposal.status <> 'pending' then raise exception 'Pending proposal not found'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
  if length(trim(p_reason)) < 3 then raise exception 'Decision reason is required'; end if;
  if not exists (
    select 1 from public.alteration_work_orders w
    where w.id = v_proposal.alteration_id
      and w.status in ('assigned','in_progress')
      and w.deleted_at is null
  ) then raise exception 'Price proposals may only be decided while assigned work is active'; end if;
  if auth.role() <> 'service_role' and (
    public.is_platform_staff()
    or v_proposal.retailer_id <> public.current_retailer_id()
    or not public.is_alterations_management()
  )
  then raise exception 'Retailer management approval is required'; end if;

  update public.price_change_proposals
  set status = p_decision, decided_by_staff_id = v_staff_id,
      decided_at = now(), decision_reason = trim(p_reason)
  where id = p_proposal_id;

  if p_decision = 'approved' then
    if v_proposal.task_id is not null then
      update public.alteration_tasks
      set agreed_price_amount_minor_units = v_proposal.proposed_amount_minor_units,
          agreed_price_currency = v_proposal.currency
      where id = v_proposal.task_id;
      select sum(coalesce(agreed_price_amount_minor_units, original_quote_amount_minor_units))
        into v_total from public.alteration_tasks
        where alteration_id = v_proposal.alteration_id and classification = 'work_now' and deleted_at is null;
    else
      v_total := v_proposal.proposed_amount_minor_units;
    end if;
    update public.alteration_work_orders
    set agreed_total_amount_minor_units = v_total,
        agreed_total_currency = v_proposal.currency
    where id = v_proposal.alteration_id;
  end if;

  insert into public.alteration_pricing_history (
    alteration_id, task_id, retailer_id, event_type, amount_minor_units,
    currency, reason, actor_staff_id
  ) values (
    v_proposal.alteration_id, v_proposal.task_id, v_proposal.retailer_id,
    case when p_decision = 'approved' then 'approval' else 'rejection' end,
    v_proposal.proposed_amount_minor_units, v_proposal.currency,
    trim(p_reason), v_staff_id
  );
end;
$$;

revoke all on function public.decide_alteration_price_change(uuid, public.price_change_proposal_status, text) from public;
grant execute on function public.decide_alteration_price_change(uuid, public.price_change_proposal_status, text) to authenticated, service_role;

create or replace function public.assign_alteration_work_order(
  p_alteration_id uuid,
  p_workshop_id uuid,
  p_target_completion_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.alteration_work_orders%rowtype;
  v_staff_id uuid := public.current_staff_id();
begin
  select * into v_order from public.alteration_work_orders where id = p_alteration_id and deleted_at is null for update;
  if v_order.id is null then raise exception 'Work order not found'; end if;
  if auth.role() <> 'service_role' and (
    public.is_platform_staff()
    or v_order.retailer_id <> public.current_retailer_id()
    or not public.is_alterations_management()
  )
  then raise exception 'Retailer management assignment is required'; end if;
  if auth.role() = 'service_role' and v_staff_id is null then
    select id into v_staff_id
    from public.retailer_staff_members
    where retailer_id = v_order.retailer_id
      and role in ('owner','admin','manager')
      and accepted_at is not null
      and deleted_at is null
    order by created_at
    limit 1;
  end if;
  if v_staff_id is null then raise exception 'An assigning staff actor is required'; end if;
  if v_order.status <> 'approved' then raise exception 'Only approved work orders can be assigned'; end if;
  if not exists (select 1 from public.workshops where id = p_workshop_id and retailer_id = v_order.retailer_id and status = 'active' and deleted_at is null) then
    raise exception 'Workshop not found';
  end if;
  update public.work_order_assignments set active = false where alteration_id = p_alteration_id and active;
  insert into public.work_order_assignments (
    alteration_id, retailer_id, workshop_id, assigned_worker_id,
    assigned_by_staff_id, target_completion_date
  ) values (
    p_alteration_id, v_order.retailer_id, p_workshop_id, null,
    v_staff_id, p_target_completion_date
  );
  update public.alteration_tasks set assigned_worker_id = null, status = 'assigned'
    where alteration_id = p_alteration_id and classification = 'work_now' and deleted_at is null;
  update public.alteration_work_orders set status = 'assigned' where id = p_alteration_id;
  insert into public.alteration_status_history (
    alteration_id, retailer_id, from_status, to_status, note,
    actor_staff_id, actor_user_id, customer_visible
  ) values (
    p_alteration_id, v_order.retailer_id, v_order.status, 'assigned',
    'Assigned to workshop', v_staff_id, auth.uid(), false
  );
end;
$$;

revoke all on function public.assign_alteration_work_order(uuid, uuid, date) from public;
grant execute on function public.assign_alteration_work_order(uuid, uuid, date) to authenticated, service_role;

create or replace function public.update_workshop_assignment(
  p_alteration_id uuid,
  p_worker_id uuid,
  p_target_completion_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.work_order_assignments%rowtype;
begin
  select * into v_assignment
  from public.work_order_assignments
  where alteration_id = p_alteration_id and active
  for update;

  if v_assignment.id is null then raise exception 'Active workshop assignment not found'; end if;
  if auth.role() <> 'service_role' and (
    public.is_platform_staff()
    or public.current_retailer_role() <> 'workshop_manager'
    or v_assignment.retailer_id <> public.current_retailer_id()
    or v_assignment.workshop_id <> public.current_workshop_id()
  ) then raise exception 'Only the assigned workshop manager may update this assignment'; end if;
  if p_worker_id is not null and not exists (
    select 1 from public.retailer_staff_members
    where id = p_worker_id
      and retailer_id = v_assignment.retailer_id
      and workshop_id = v_assignment.workshop_id
      and role = 'worker'
      and accepted_at is not null
      and deleted_at is null
  ) then raise exception 'Worker is not authorized for this workshop'; end if;

  update public.work_order_assignments
  set assigned_worker_id = p_worker_id,
      target_completion_date = p_target_completion_date
  where id = v_assignment.id;

  -- Keep task authorization synchronized with the active assignment so a
  -- replaced worker immediately loses access to the order's actionable tasks.
  update public.alteration_tasks
  set assigned_worker_id = p_worker_id
  where alteration_id = p_alteration_id
    and classification = 'work_now'
    and deleted_at is null;
end;
$$;

revoke all on function public.update_workshop_assignment(uuid, uuid, date) from public;
grant execute on function public.update_workshop_assignment(uuid, uuid, date) to authenticated, service_role;

create or replace function public.update_alteration_task_status(
  p_task_id uuid,
  p_status public.alteration_task_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.alteration_tasks%rowtype;
  v_role text := public.current_retailer_role();
begin
  select * into v_task from public.alteration_tasks where id = p_task_id and deleted_at is null for update;
  if v_task.id is null or v_task.classification <> 'work_now' then raise exception 'Actionable task not found'; end if;
  if not public.can_access_alteration_work_order(v_task.alteration_id) then raise exception 'Not authorized for task'; end if;
  if auth.role() <> 'service_role' and (
    public.is_platform_staff()
    or v_role not in ('owner','admin','manager','production_staff','workshop_manager','worker')
  )
  then raise exception 'This role cannot perform alteration work'; end if;
  if v_role = 'worker' and v_task.assigned_worker_id <> public.current_staff_id() then raise exception 'Worker is not assigned this task'; end if;
  if v_role in ('workshop_manager','worker') and p_status = 'in_progress'
    and coalesce((
      select latest.event_type is distinct from 'handed_to_workshop'
      from public.chain_of_custody_events latest
      where latest.alteration_id = v_task.alteration_id
      order by latest.occurred_at desc, latest.id desc
      limit 1
    ), true)
  then raise exception 'Workshop custody is required before task work starts'; end if;
  if p_status not in ('in_progress','review_ready') then raise exception 'Tasks may only be started or marked review-ready directly'; end if;
  if not (
    (v_task.status = 'assigned' and p_status = 'in_progress')
    or (v_task.status = 'in_progress' and p_status = 'review_ready')
    or (v_task.status = 'review_ready' and p_status = 'in_progress')
  ) then raise exception 'Invalid alteration task transition: % to %', v_task.status, p_status; end if;
  update public.alteration_tasks set status = p_status where id = p_task_id;
  if nullif(trim(p_note), '') is not null then
    if length(trim(p_note)) > 2000 then raise exception 'Work note is too long'; end if;
    insert into public.alteration_task_notes (
      alteration_id, task_id, retailer_id, note, actor_staff_id
    ) values (
      v_task.alteration_id, v_task.id, v_task.retailer_id,
      trim(p_note), public.current_staff_id()
    );
  end if;
end;
$$;

revoke all on function public.update_alteration_task_status(uuid, public.alteration_task_status, text) from public;
grant execute on function public.update_alteration_task_status(uuid, public.alteration_task_status, text) to authenticated, service_role;

create or replace function public.add_alteration_task_note(
  p_task_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.alteration_tasks%rowtype;
  v_note_id uuid;
begin
  select * into v_task
  from public.alteration_tasks
  where id = p_task_id and deleted_at is null;

  if v_task.id is null or v_task.classification <> 'work_now' then
    raise exception 'Actionable task not found';
  end if;
  if v_task.status not in ('assigned','in_progress','review_ready') then
    raise exception 'Work notes may only be added while a task is active';
  end if;
  if length(trim(coalesce(p_note, ''))) not between 1 and 2000 then
    raise exception 'Work note must be between 1 and 2000 characters';
  end if;
  if not public.can_access_alteration_work_order(v_task.alteration_id) then
    raise exception 'Not authorized for task';
  end if;
  if auth.role() <> 'service_role' and (
    public.is_platform_staff()
    or public.current_retailer_role() not in ('owner','admin','manager','production_staff','workshop_manager','worker')
    or (
      public.current_retailer_role() = 'worker'
      and v_task.assigned_worker_id <> public.current_staff_id()
    )
  ) then
    raise exception 'This role cannot add a work note';
  end if;

  insert into public.alteration_task_notes (
    alteration_id, task_id, retailer_id, note, actor_staff_id
  ) values (
    v_task.alteration_id, v_task.id, v_task.retailer_id,
    trim(p_note), public.current_staff_id()
  ) returning id into v_note_id;

  return v_note_id;
end;
$$;

revoke all on function public.add_alteration_task_note(uuid, text) from public;
grant execute on function public.add_alteration_task_note(uuid, text) to authenticated, service_role;

-- Workers receive purpose-built projections with no customer record or pricing
-- columns. Their base-table policies are intentionally false even when they
-- are assigned to the work order.
create view public.worker_alteration_work_orders
with (security_barrier = true)
as
select
  w.id,
  w.retailer_id,
  w.physical_garment_id,
  w.work_order_number,
  w.status,
  g.category_code,
  g.garment_type,
  g.brand,
  g.description,
  g.intake_condition,
  w.due_date,
  w.created_at,
  w.updated_at
from public.alteration_work_orders w
join public.physical_garments g on g.id = w.physical_garment_id
where public.current_retailer_role() = 'worker'
  and w.deleted_at is null
  and exists (
    select 1 from public.alteration_tasks t
    where t.alteration_id = w.id
      and t.assigned_worker_id = public.current_staff_id()
      and t.classification = 'work_now'
      and t.deleted_at is null
  );

create view public.worker_alteration_tasks
with (security_barrier = true)
as
select
  t.id,
  t.alteration_id,
  t.retailer_id,
  t.operation_id,
  t.title,
  t.instructions,
  t.classification,
  t.status,
  t.assigned_worker_id,
  t.created_at,
  t.updated_at
from public.alteration_tasks t
where public.current_retailer_role() = 'worker'
  and t.assigned_worker_id = public.current_staff_id()
  and t.classification = 'work_now'
  and t.deleted_at is null;

revoke all on public.worker_alteration_work_orders from public;
revoke all on public.worker_alteration_tasks from public;
grant select on public.worker_alteration_work_orders to authenticated;
grant select on public.worker_alteration_tasks to authenticated;

-- Customer Portal gets purpose-built safe projections, never base-table
-- access. Internal notes, unapproved pricing, workshop identities and evidence
-- are absent by construction.
create view public.customer_alteration_work_orders
with (security_barrier = true)
as
select
  w.id,
  w.retailer_id,
  w.customer_id,
  w.physical_garment_id,
  w.work_order_number,
  w.status,
  w.due_date,
  w.agreed_total_amount_minor_units,
  w.agreed_total_currency,
  w.customer_notification_ready_at,
  g.category_code,
  g.garment_type,
  g.brand,
  g.description,
  w.created_at,
  w.updated_at
from public.alteration_work_orders w
join public.physical_garments g on g.id = w.physical_garment_id
join public.customers c on c.id = w.customer_id
where c.user_id = auth.uid()
  and w.deleted_at is null
  and (
    w.status in ('approved','assigned','in_progress','completion_review','ready_for_pickup','out_for_delivery','completed')
    or (w.status = 'canceled' and exists (
      select 1 from public.alteration_status_history approval
      where approval.alteration_id = w.id and approval.to_status = 'approved'
    ))
  );

create view public.customer_alteration_status_history
with (security_barrier = true)
as
select h.id, h.alteration_id, h.to_status, h.note, h.created_at
from public.alteration_status_history h
join public.alteration_work_orders w on w.id = h.alteration_id
join public.customers c on c.id = w.customer_id
where c.user_id = auth.uid()
  and h.customer_visible
  and (
    w.status in ('approved','assigned','in_progress','completion_review','ready_for_pickup','out_for_delivery','completed')
    or (w.status = 'canceled' and exists (
      select 1 from public.alteration_status_history approval
      where approval.alteration_id = w.id and approval.to_status = 'approved'
    ))
  );

create view public.customer_alteration_fulfillment
with (security_barrier = true)
as
select f.id, f.alteration_id, f.method, f.status, f.scheduled_at, f.completed_at,
       f.delivery_address, f.released_to_name, f.created_at, f.updated_at
from public.alteration_fulfillment_events f
join public.alteration_work_orders w on w.id = f.alteration_id
join public.customers c on c.id = w.customer_id
where c.user_id = auth.uid()
  and f.deleted_at is null
  and (
    w.status in ('approved','assigned','in_progress','completion_review','ready_for_pickup','out_for_delivery','completed')
    or (w.status = 'canceled' and exists (
      select 1 from public.alteration_status_history approval
      where approval.alteration_id = w.id and approval.to_status = 'approved'
    ))
  );

revoke all on public.customer_alteration_work_orders from public;
revoke all on public.customer_alteration_status_history from public;
revoke all on public.customer_alteration_fulfillment from public;
grant select on public.customer_alteration_work_orders to authenticated;
grant select on public.customer_alteration_status_history to authenticated;
grant select on public.customer_alteration_fulfillment to authenticated;

-- RLS is the boundary, but removing grants from the archived tables ensures
-- no future permissive policy can accidentally reactivate the superseded model.
revoke all on public.legacy_customer_fit_profile_entries from authenticated, anon;
revoke all on public.legacy_alterations from authenticated, anon;
revoke all on public.legacy_alteration_updates from authenticated, anon;
