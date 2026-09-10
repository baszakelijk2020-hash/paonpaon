-- The login Server Action supplies HMAC keys; this table never retains a raw
-- address, IP, pair, or recognition outcome.
create table public.auth_email_recognition_rate_limits (
  scope text not null check (scope in ('ip', 'email', 'pair')),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  primary key (scope, key_hash, window_started_at)
);

alter table public.auth_email_recognition_rate_limits enable row level security;
revoke all on table public.auth_email_recognition_rate_limits from public, anon, authenticated;

-- Fixed, independent five-minute limits: 10 per source IP, 5 per normalized
-- email, and 8 per IP/email pair. The function is service-role-only because
-- visible account recognition is intentionally confined to the Server Action.
create or replace function public.recognize_customer_login_email(
  p_normalized_email text,
  p_email_hash text,
  p_ip_hash text,
  p_pair_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window_started_at timestamptz;
  v_attempts integer;
begin
  if p_normalized_email is null
    or p_normalized_email <> lower(btrim(p_normalized_email))
    or p_normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_email_hash !~ '^[0-9a-f]{64}$'
    or p_ip_hash !~ '^[0-9a-f]{64}$'
    or p_pair_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid recognition input' using errcode = '22023';
  end if;

  v_window_started_at := date_trunc('hour', clock_timestamp())
    + (floor(extract(minute from clock_timestamp()) / 5) * interval '5 minutes');

  -- Serialise each bounded key before its capped atomic upsert. This avoids
  -- racing an over-limit request through the recognition lookup.
  perform pg_advisory_xact_lock(hashtextextended('auth_email_recognition:ip:' || p_ip_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('auth_email_recognition:email:' || p_email_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('auth_email_recognition:pair:' || p_pair_hash, 0));

  insert into public.auth_email_recognition_rate_limits (scope, key_hash, window_started_at, attempts)
  values ('ip', p_ip_hash, v_window_started_at, 1)
  on conflict (scope, key_hash, window_started_at) do update
    set attempts = auth_email_recognition_rate_limits.attempts + 1
    where auth_email_recognition_rate_limits.attempts < 10
  returning attempts into v_attempts;
  if v_attempts is null then return jsonb_build_object('allowed', false); end if;

  insert into public.auth_email_recognition_rate_limits (scope, key_hash, window_started_at, attempts)
  values ('email', p_email_hash, v_window_started_at, 1)
  on conflict (scope, key_hash, window_started_at) do update
    set attempts = auth_email_recognition_rate_limits.attempts + 1
    where auth_email_recognition_rate_limits.attempts < 5
  returning attempts into v_attempts;
  if v_attempts is null then return jsonb_build_object('allowed', false); end if;

  insert into public.auth_email_recognition_rate_limits (scope, key_hash, window_started_at, attempts)
  values ('pair', p_pair_hash, v_window_started_at, 1)
  on conflict (scope, key_hash, window_started_at) do update
    set attempts = auth_email_recognition_rate_limits.attempts + 1
    where auth_email_recognition_rate_limits.attempts < 8
  returning attempts into v_attempts;
  if v_attempts is null then return jsonb_build_object('allowed', false); end if;

  return jsonb_build_object(
    'allowed', true,
    'existing', exists (
      select 1 from auth.users where lower(email) = p_normalized_email
    )
  );
end;
$$;

revoke all on function public.recognize_customer_login_email(text, text, text, text) from public;
grant execute on function public.recognize_customer_login_email(text, text, text, text) to service_role;

