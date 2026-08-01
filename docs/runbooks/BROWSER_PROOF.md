# Browser and Live Proof Runbook

Read this only when the active slice needs browser or live integration proof.

## Proof order

Migration -> live integration against an explicitly disposable database ->
repository/server action -> originating UI -> receiving UI -> persisted
outcome/exception.

## Recurring failure modes

- A correct pure rule can be unreachable. Verify the caller reaches the branch
  under test.
- Native client validation can stop a request before a server rule. Test the
  client validity and server rejection separately.
- Supabase writes return error objects. Assert the result on every write.
- Scope form IDs by row; repeated literal IDs break labels and actions.
- Choose fixture values that clear every threshold except the rule under test.
- Poll machine-readable exact state, not a substring or mere row existence.
- Scope forbidden-copy guards to the element; explanatory copy can match the
  forbidden term.
- Make identifiers unique per run and clean all created rows in teardown.
- A pending flag/review candidate can block later suites; cleanup is part of
  the spec.
- Read product copy and state before changing code to satisfy a test. A stale
  build or incorrect assertion can imitate a product defect.

## UI proof checklist

- role orientation and next action;
- primary success journey;
- loading, empty, denied, stale, conflict and error states as applicable;
- receiving role sees the persisted result;
- correction, reversal or recovery path;
- responsive primary contexts and accessibility;
- database assertion for source authority, tenant and money/stock/time/fit
  invariants.
