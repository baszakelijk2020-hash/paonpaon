-- Correct the FNV-1a byte XOR used for canonical payroll export content.
-- This is forward-only: previously recorded export rows remain immutable.
create or replace function public.payroll_export_checksum(p_content text)
returns text language plpgsql immutable strict set search_path = '' as $$
declare v_hash bit(32) := x'811c9dc5'; v_index integer;
begin
  for v_index in 1..char_length(p_content) loop
    v_hash := v_hash # ascii(substr(p_content, v_index, 1))::bit(32);
    v_hash := ((v_hash::bigint * 16777619) % 4294967296)::bit(32);
  end loop;
  return lpad(to_hex(v_hash::bigint), 8, '0');
end; $$;
