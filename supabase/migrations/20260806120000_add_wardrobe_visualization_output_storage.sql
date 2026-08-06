-- Virtual Wardrobe Studio — generated outputs must be copied into
-- PAON-controlled private Storage with signed delivery (VWS-001 / PHASE
-- 4.6/4.8), not left as a bare provider URL. `output_image_url` (a raw
-- string column, no provenance) is replaced with
-- `output_storage_bucket`/`output_storage_path`, mirroring the
-- silhouette-evidence/style-portrait pattern exactly. The queue runner
-- downloads the provider's temporary URL and re-uploads it into
-- `wardrobe-studio` before ever calling `complete_wardrobe_visualization_job`
-- — a customer/advisor never sees a raw provider URL.

alter table public.wardrobe_visualization_jobs
  drop constraint if exists wardrobe_visualization_jobs_ready_output_chk;

alter table public.wardrobe_visualization_jobs
  add column if not exists output_storage_bucket text,
  add column if not exists output_storage_path text;

alter table public.wardrobe_visualization_jobs
  add constraint wardrobe_visualization_jobs_ready_output_chk check (
    status <> 'ready'
    or (output_storage_bucket is not null and output_storage_path is not null)
  );

alter table public.wardrobe_visualization_jobs
  drop column if exists output_image_url;

create unique index if not exists wardrobe_visualization_jobs_output_object_uidx
  on public.wardrobe_visualization_jobs (output_storage_bucket, output_storage_path)
  where output_storage_path is not null;

-- Completion now takes the storage location, never a raw URL.
create or replace function public.complete_wardrobe_visualization_job(
  p_job_id uuid,
  p_status text,
  p_output_storage_bucket text default null,
  p_output_storage_path text default null,
  p_error_message text default null,
  p_actual_cost_cents integer default null
)
returns public.wardrobe_visualization_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.wardrobe_visualization_jobs%rowtype;
begin
  if p_status not in ('ready', 'failed') then
    raise exception 'Invalid completion status';
  end if;

  update public.wardrobe_visualization_jobs
    set status = p_status,
        output_storage_bucket = p_output_storage_bucket,
        output_storage_path = p_output_storage_path,
        error_message = p_error_message,
        actual_cost_cents = coalesce(p_actual_cost_cents, actual_cost_cents)
    where id = p_job_id and status = 'generating'
    returning * into v_job;

  if v_job.id is null then
    raise exception 'Job not found or not in progress';
  end if;

  return v_job;
end;
$$;

revoke all on function public.complete_wardrobe_visualization_job(
  uuid, text, text, text, text, integer
) from public;
grant execute on function public.complete_wardrobe_visualization_job(
  uuid, text, text, text, text, integer
) to service_role;

-- The old five-arg signature (with a raw output_image_url) is gone —
-- drop it explicitly so an outdated caller fails loudly, not silently.
drop function if exists public.complete_wardrobe_visualization_job(
  uuid, text, text, text, integer
);

-- Storage RLS already scopes the wardrobe-studio bucket by
-- retailer/customer folder (can_access_wardrobe_studio_object,
-- 20260806100000); generation outputs are written by the service-role
-- queue runner, which bypasses Storage RLS entirely, exactly as that
-- migration already documented.
