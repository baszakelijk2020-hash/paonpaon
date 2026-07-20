-- "Today's Pick" (MorningRoutine-inspired, ADR-035): a customer-
-- initiated product_recommendation generation, recorded through a
-- narrow security-definer RPC rather than broadening
-- ai_generations' existing staff-only insert policy — same
-- "security definer RPC over a broadened RLS policy for a narrow
-- state transition a caller triggers about themselves" convention as
-- get_or_create_my_conversation. Re-derives customer_id/retailer_id
-- from the caller's own customers row; never trusts a client-supplied
-- customer_id.

create or replace function public.record_customer_ai_generation(
  p_retailer_id uuid,
  p_status public.ai_generation_status,
  p_model text,
  p_input_summary text,
  p_output jsonb default null,
  p_error_message text default null,
  p_latency_ms integer default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_id uuid;
begin
  select id into v_customer_id
  from public.customers
  where retailer_id = p_retailer_id and user_id = auth.uid() and deleted_at is null;

  if v_customer_id is null then
    raise exception 'Customer relationship required';
  end if;

  insert into public.ai_generations (
    retailer_id, customer_id, kind, status, provider, model,
    input_summary, output, error_message, latency_ms
  ) values (
    p_retailer_id, v_customer_id, 'product_recommendation', p_status, 'openai', p_model,
    p_input_summary, p_output, p_error_message, p_latency_ms
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_customer_ai_generation(
  uuid, public.ai_generation_status, text, text, jsonb, text, integer
) from public;
grant execute on function public.record_customer_ai_generation(
  uuid, public.ai_generation_status, text, text, jsonb, text, integer
) to authenticated, service_role;
