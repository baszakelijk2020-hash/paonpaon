alter table public.commercial_prospects
  alter column created_by_user_id set default auth.uid();

create or replace function public.protect_commercial_prospect_creator()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.created_by_user_id is distinct from old.created_by_user_id
    and auth.role() <> 'service_role'
  then
    raise exception 'Prospect creator attribution is immutable';
  end if;
  if tg_op = 'INSERT' and auth.role() <> 'service_role' then
    new.created_by_user_id := auth.uid();
  end if;
  return new;
end;
$$;

create trigger protect_commercial_prospect_creator
  before insert or update on public.commercial_prospects
  for each row execute function public.protect_commercial_prospect_creator();
