# Night Shift Blockers

## FT-04 alteration grid, snapshot and selective work-order flow

The highest-priority owned portion requires a new Supabase migration, generated
database types, repository/RPC wiring and database proof. It cannot be completed
in this lane because the full PHASE acceptance contract also requires retailer UI
components and browser E2E coverage outside the permitted ownership boundary.

Required changes outside this lane:

- `apps/retailer/**`: implement the founder-specified two-column alteration grid,
  immutable-snapshot lock/unlock experience, and dark-overlay selective
  work-order flow wired to the alteration-grid RPC contract.
- `apps/retailer/**`: add browser coverage for advisor/management role gates,
  lock/unlock, snapshot immutability, selective work-order creation, and denied
  paths.
- Environment: provide Docker, then run `supabase start` and `supabase db reset`
  so the migration can be applied, generated Supabase database types regenerated,
  and the resulting package type errors verified.

