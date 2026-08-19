-- Fix claim_pending_wardrobe_visualization_jobs: the ORDER BY in the
-- previous version (20260807110000) only ordered the id-selection subquery,
-- not the UPDATE ... RETURNING itself. Postgres does not guarantee that
-- UPDATE ... WHERE id IN (subquery) RETURNING * preserves the subquery's
-- row order — RETURNING reflects heap/plan order, which is unrelated to it.
-- Confirmed live: apps/customer/e2e/virtual-studio-batch-and-feedback-evidence.spec.ts
-- (item 4.10) deterministically returned two queued jobs in reverse of their
-- (created_at, id) order on every run. Wrap the claim in a CTE and apply the
-- real ordering to the outer SELECT, which Postgres does preserve for a
-- simple, unordered-by-anything-else outer query.
create or replace function public.claim_pending_wardrobe_visualization_jobs(
  p_limit integer default 5
)
returns setof public.wardrobe_visualization_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    with claimed as (
      update public.wardrobe_visualization_jobs
      set status = 'generating', attempt = attempt + 1
      where id in (
        select id from public.wardrobe_visualization_jobs
        where status = 'queued'
        order by created_at, id
        limit p_limit
        for update skip locked
      )
      returning *
    )
    select * from claimed
    order by created_at, id;
end;
$$;

revoke all on function public.claim_pending_wardrobe_visualization_jobs(integer)
  from public;
grant execute on function public.claim_pending_wardrobe_visualization_jobs(integer)
  to service_role;
