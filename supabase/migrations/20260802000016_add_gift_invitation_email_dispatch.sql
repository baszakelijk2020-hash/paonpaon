-- FT-10 gap closure: "Send invitation" created a gift_invitations row and
-- the retailer page showed the raw redeem link as text for the manager to
-- copy — nothing was ever actually sent. This adds the missing dispatch
-- step through the existing email_outbox/dispatch-emails path (ADR-032),
-- the same "one universal hook" outbox every other transactional email in
-- this codebase already drains through. gift_invitations has no
-- recipient_user_id (the recipient is an anonymous, non-PAON person), so
-- the notifications-insert trigger that normally populates email_outbox
-- cannot apply here — a narrow SECURITY DEFINER RPC is the correct
-- alternative, matching enqueue_morning_routine_delivery_notification's
-- shape. The customer-app base URL is the deploying operator's own env
-- var (NEXT_PUBLIC_CUSTOMER_APP_URL), never attacker input, so passing it
-- as a parameter carries no injection risk; every other value in the
-- email body is read server-side from the invitation/experience/retailer
-- rows, not trusted from the caller.

alter table public.gift_invitations
  add column email_sent_at timestamptz;

create or replace function public.enqueue_gift_invitation_email(
  p_invitation_id uuid,
  p_customer_app_base_url text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.gift_invitations%rowtype;
  v_experience public.gift_experiences%rowtype;
  v_retailer public.retailers%rowtype;
  v_redeem_url text;
  v_greeting text;
  v_outbox_id uuid;
begin
  select * into v_invitation
    from public.gift_invitations
    where id = p_invitation_id;
  if not found then
    raise exception 'Invitation not found';
  end if;

  select * into v_experience
    from public.gift_experiences
    where id = v_invitation.gift_experience_id and deleted_at is null;
  if not found then
    raise exception 'Invitation not found';
  end if;

  if auth.role() <> 'service_role' and (
    v_experience.retailer_id <> public.current_retailer_id()
    or public.current_retailer_role() not in ('manager', 'admin', 'owner')
  ) then
    raise exception 'Only retailer managers may email a gift invitation';
  end if;

  if v_invitation.recipient_email is null then
    raise exception 'This invitation has no recipient email on file';
  end if;
  if v_invitation.status not in ('pending', 'opened') then
    raise exception 'This invitation is % and can no longer be sent', v_invitation.status;
  end if;

  select * into v_retailer
    from public.retailers
    where id = v_experience.retailer_id;
  if not found then
    raise exception 'Retailer not found';
  end if;

  v_redeem_url := rtrim(p_customer_app_base_url, '/') || '/r/' || v_retailer.slug
    || '/gift/' || v_invitation.invite_token::text;
  v_greeting := coalesce(nullif(trim(v_invitation.recipient_name), ''), 'there');

  insert into public.email_outbox (recipient_email, subject, html_body)
  values (
    v_invitation.recipient_email,
    v_experience.title || ' — a gift from ' || v_retailer.display_name,
    '<p>Hi ' || v_greeting || ',</p>'
      || '<p>' || v_experience.intro_message || '</p>'
      || '<p><a href="' || v_redeem_url || '">Open your gift</a></p>'
  )
  returning id into v_outbox_id;

  update public.gift_invitations
    set email_sent_at = now()
    where id = p_invitation_id;

  return v_outbox_id;
end;
$$;

grant execute on function public.enqueue_gift_invitation_email(uuid, text)
  to authenticated;
