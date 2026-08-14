-- FT-09 attachment quarantine: manual staff release.
--
-- `retry_message_attachment_scan` already lets staff requeue a *failed*
-- upload, but nothing lets staff clear an upload stuck in `pending_scan`
-- or `quarantined` — and nothing will, until a scanner provider is chosen
-- (see PHASE.md execution queue item 5 / the pipeline migration's own
-- comment: "No scanner/provider is activated here"). Until then, uploads
-- queue indefinitely with no way to ever become visible. This is the
-- retry/release surface the doc says to build regardless of which scanner
-- is eventually chosen: a deliberate, attributable human-review release,
-- not an automated clear.

create or replace function public.release_message_attachment(
  p_attachment_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attachment public.message_attachments%rowtype;
  v_staff public.retailer_staff_members%rowtype;
begin
  select * into v_attachment
    from public.message_attachments
    where id = p_attachment_id;
  if not found then
    raise exception 'Attachment not found';
  end if;

  select * into v_staff
    from public.retailer_staff_members
    where retailer_id = v_attachment.retailer_id
      and user_id = auth.uid()
      and accepted_at is not null
      and deleted_at is null;
  if v_staff.id is null
    or v_staff.role not in ('sales_associate', 'manager', 'admin', 'owner')
  then
    raise exception 'Not authorized';
  end if;

  if v_attachment.source_kind <> 'upload' then
    raise exception 'Only uploads go through quarantine review';
  end if;
  if v_attachment.scan_status = 'cleared' then
    raise exception 'Already cleared';
  end if;

  update public.message_attachments
    set scan_status = 'cleared'
    where id = v_attachment.id;

  update public.message_attachment_scan_jobs
    set status = 'cleared',
        completed_at = now(),
        updated_at = now()
    where attachment_id = v_attachment.id;
end;
$$;

revoke all on function public.release_message_attachment(uuid) from public;
grant execute on function public.release_message_attachment(uuid)
  to authenticated, service_role;
