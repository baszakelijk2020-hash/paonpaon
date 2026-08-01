begin;
select plan(8);

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
  array['uuid', 'text', 'text', 'text', 'text', 'bigint', 'text', 'text'],
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
    'public.record_consultation_attachment(uuid,text,text,text,text,bigint,text,text)'::regprocedure
  )) like '%invalid pinterest reference%'
  and pg_get_functiondef(
    'public.record_consultation_attachment(uuid,text,text,text,text,bigint,text,text)'::regprocedure
  ) like '%p_source_url !~%',
  'database command independently constrains Pinterest references'
);

select * from finish();
rollback;
