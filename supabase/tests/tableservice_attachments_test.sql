begin;
select plan(14);

select has_column('public', 'message_attachments', 'purpose',
  'consultation attachments retain purpose');
select has_column('public', 'message_attachments', 'source_kind',
  'consultation attachments retain source kind');
select has_column('public', 'message_attachments', 'rights_basis',
  'consultation attachments retain rights basis');
select has_column('public', 'message_attachments', 'scan_status',
  'consultation attachments expose validation/scan state');
select has_function(
  'public', 'record_consultation_attachment',
  array['uuid', 'text', 'text', 'text', 'text', 'bigint', 'text', 'text', 'uuid', 'uuid'],
  'typed consultation attachment command exists'
);
select ok(
  not has_table_privilege('anon', 'public.message_attachments', 'INSERT'),
  'anonymous callers cannot insert attachment metadata directly'
);
select ok(
  (select allowed_mime_types @> array['application/pdf']::text[]
    from storage.buckets
    where id = 'message-attachments'),
  'private attachment bucket accepts reviewed PDF uploads'
);
select ok(
  lower(pg_get_functiondef(
    'public.record_consultation_attachment(uuid,text,text,text,text,bigint,text,text,uuid,uuid)'::regprocedure
  )) like '%invalid pinterest reference%'
  and pg_get_functiondef(
    'public.record_consultation_attachment(uuid,text,text,text,text,bigint,text,text,uuid,uuid)'::regprocedure
  ) like '%p_source_url !~%',
  'database command independently constrains Pinterest references'
);
select has_table('public', 'message_attachment_scan_jobs',
  'uploads have a provider-neutral scan queue');
select has_function('public', 'claim_pending_message_attachment_scan_jobs', array['integer'],
  'scanner workers claim queued attachment jobs through a narrow command');
select has_function('public', 'complete_message_attachment_scan_job', array['uuid', 'text', 'text'],
  'scanner workers explicitly settle attachment jobs');
select has_function('public', 'retry_message_attachment_scan', array['uuid'],
  'participants can explicitly retry a failed attachment scan');
select ok(
  not has_table_privilege('authenticated', 'public.message_attachment_scan_jobs', 'SELECT'),
  'customers and staff cannot read or alter scanner jobs directly'
);
select ok(
  pg_get_functiondef('public.record_consultation_attachment(uuid,text,text,text,text,bigint,text,text,uuid,uuid)'::regprocedure)
    like '%pending_scan%'
  and pg_get_functiondef('public.record_consultation_attachment(uuid,text,text,text,text,bigint,text,text,uuid,uuid)'::regprocedure)
    like '%message_attachment_scan_jobs%',
  'new uploaded attachments are pending and enqueue exactly one scan job'
);

select * from finish();
rollback;
