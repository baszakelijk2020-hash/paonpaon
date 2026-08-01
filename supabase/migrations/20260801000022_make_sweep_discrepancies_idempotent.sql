-- A retried sweep must not double the work a person has to read.
--
-- `rfid_sweep_discrepancies` had no uniqueness across (sweep, tag, kind), so
-- reconciling the same sweep twice — which happens whenever a reader drops its
-- connection and the adapter retries — appended a second identical row. The
-- pilot would then look like it found twice as many problems as it did, and a
-- person resolving one copy would leave the other open forever.
--
-- Collapse any existing duplicates first, keeping the earliest (and any
-- resolution already written against it).
delete from public.rfid_sweep_discrepancies d
using public.rfid_sweep_discrepancies keep
where d.sweep_id = keep.sweep_id
  and d.epc = keep.epc
  and d.kind = keep.kind
  and (d.created_at, d.id) > (keep.created_at, keep.id);

alter table public.rfid_sweep_discrepancies
  drop constraint if exists rfid_sweep_discrepancy_unique;
alter table public.rfid_sweep_discrepancies
  add constraint rfid_sweep_discrepancy_unique
  unique (sweep_id, epc, kind);
