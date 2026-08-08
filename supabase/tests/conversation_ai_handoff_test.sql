begin;
select plan(17);

select has_table('public', 'message_ai_drafts', 'conversation draft table exists');
select has_column('public', 'conversations', 'claimed_by_staff_id', 'conversation claim is persisted');
select has_function('public', 'approve_conversation_ai_draft', array['uuid', 'text'], 'atomic approve-and-send command exists');
select has_function('public', 'dismiss_conversation_ai_draft', array['uuid'], 'draft dismissal command exists');
select ok(not has_table_privilege('authenticated', 'public.message_ai_drafts', 'INSERT'), 'staff cannot insert AI proposals directly');
select ok(not has_table_privilege('authenticated', 'public.message_ai_drafts', 'UPDATE'), 'staff cannot resolve AI proposals directly');

insert into public.retailers (id, legal_name, display_name, slug, status) values
  ('d1000000-0000-4000-8000-000000000001', 'Draft House A Ltd', 'Draft House A', 'draft-house-a', 'active'),
  ('d1000000-0000-4000-8000-000000000002', 'Draft House B Ltd', 'Draft House B', 'draft-house-b', 'active');

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('d2000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'draft-a@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('d2000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'draft-b@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('d2000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'draft-a-other@example.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.retailer_staff_members (id, retailer_id, user_id, full_name, email, role, accepted_at) values
  ('d3000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'Advisor A', 'draft-a@example.test', 'sales_associate', now()),
  ('d3000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000002', 'Advisor B', 'draft-b@example.test', 'sales_associate', now()),
  ('d3000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000003', 'Other Advisor A', 'draft-a-other@example.test', 'sales_associate', now());

insert into public.customers (id, retailer_id, full_name, email) values
  ('d4000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'Prospect A', 'prospect-a@example.test'),
  ('d4000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', 'Prospect B', 'prospect-b@example.test');

insert into public.conversations (id, retailer_id, customer_id, status) values
  ('d5000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-000000000001', 'needs_human'),
  ('d5000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', 'd4000000-0000-4000-8000-000000000002', 'needs_human');

insert into public.messages (id, conversation_id, sender_type, body) values
  ('d6000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000001', 'ai_assistant', 'Source A'),
  ('d6000000-0000-4000-8000-000000000002', 'd5000000-0000-4000-8000-000000000002', 'ai_assistant', 'Source B');

select throws_ok(
  $$ update public.conversations set claimed_by_staff_id = 'd3000000-0000-4000-8000-000000000002', claimed_at = now() where id = 'd5000000-0000-4000-8000-000000000001' $$,
  'P0001', 'Claimed advisor must belong to the conversation retailer',
  'a conversation cannot reference another House advisor'
);

select throws_ok(
  $$ insert into public.message_ai_drafts (retailer_id, conversation_id, based_on_message_id, draft_text) values ('d1000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000002', 'd6000000-0000-4000-8000-000000000002', 'Cross-House draft') $$,
  'P0001', 'Draft conversation must belong to the draft retailer',
  'a draft cannot name another House conversation'
);

select throws_ok(
  $$ insert into public.message_ai_drafts (retailer_id, conversation_id, based_on_message_id, draft_text) values ('d1000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000001', 'd6000000-0000-4000-8000-000000000002', 'Wrong source') $$,
  'P0001', 'Draft source message must belong to the draft conversation',
  'a draft cannot cite a message from another conversation'
);

insert into public.message_ai_drafts (id, retailer_id, conversation_id, based_on_message_id, draft_text, knowledge_object_ids) values
  ('d7000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000001', 'd6000000-0000-4000-8000-000000000001', 'Grounded reply A', '["knowledge-a"]'::jsonb),
  ('d7000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', 'd5000000-0000-4000-8000-000000000002', 'd6000000-0000-4000-8000-000000000002', 'Grounded reply B', '["knowledge-b"]'::jsonb);

select throws_ok(
  $$ insert into public.message_ai_drafts (retailer_id, conversation_id, based_on_message_id, draft_text) values ('d1000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000001', 'd6000000-0000-4000-8000-000000000001', 'Concurrent proposal') $$,
  '23505',
  'duplicate key value violates unique constraint "message_ai_drafts_one_proposed_per_conversation_idx"',
  'a conversation cannot retain two concurrent proposed drafts'
);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d2000000-0000-4000-8000-000000000001",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "d1000000-0000-4000-8000-000000000001",
    "retailer_role": "sales_associate"
  }
}';

select throws_ok(
  $$ select public.claim_conversation('d5000000-0000-4000-8000-000000000002') $$,
  'P0001', 'Not authorized',
  'staff cannot claim another House conversation'
);

select throws_ok(
  $$ select public.approve_conversation_ai_draft('d7000000-0000-4000-8000-000000000002', null) $$,
  'P0001', 'Not authorized',
  'staff cannot approve another House draft'
);

select ok(
  public.claim_conversation('d5000000-0000-4000-8000-000000000001'),
  'an eligible advisor can claim their own House conversation'
);

set local request.jwt.claims = '{
  "sub": "d2000000-0000-4000-8000-000000000003",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "d1000000-0000-4000-8000-000000000001",
    "retailer_role": "sales_associate"
  }
}';

select throws_ok(
  $$ select public.approve_conversation_ai_draft('d7000000-0000-4000-8000-000000000001', null) $$,
  'P0001', 'Only the assigned advisor or a manager can approve this draft',
  'another same-House associate cannot approve the assigned advisor draft'
);

select throws_ok(
  $$ select public.dismiss_conversation_ai_draft('d7000000-0000-4000-8000-000000000001') $$,
  'P0001', 'Only the assigned advisor or a manager can dismiss this draft',
  'another same-House associate cannot dismiss the assigned advisor draft'
);

set local request.jwt.claims = '{
  "sub": "d2000000-0000-4000-8000-000000000001",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "d1000000-0000-4000-8000-000000000001",
    "retailer_role": "sales_associate"
  }
}';

select ok(
  public.approve_conversation_ai_draft('d7000000-0000-4000-8000-000000000001', 'Advisor-reviewed reply') is not null,
  'approval returns the id of the real advisor message it sent'
);

-- A separate statement: the approve() call above is a volatile function whose
-- writes share the calling statement's own MVCC snapshot, so a subquery in
-- the SAME statement cannot observe them. Verifying in the next statement
-- reads them under a fresh read-committed snapshot instead.
select ok(
  exists (
    select 1 from public.message_ai_drafts d
    join public.messages m on m.id = d.sent_message_id
    where d.id = 'd7000000-0000-4000-8000-000000000001'
      and d.status = 'edited_and_sent'
      and m.body = 'Advisor-reviewed reply'
      and m.sender_staff_id = 'd3000000-0000-4000-8000-000000000001'
  )
  and (select status = 'waiting_for_customer' from public.conversations where id = 'd5000000-0000-4000-8000-000000000001'),
  'approval atomically records provenance, sends as the real advisor, and advances the queue'
);

select * from finish();
rollback;
