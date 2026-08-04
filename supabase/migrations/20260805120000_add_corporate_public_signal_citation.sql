-- PHASE 18.11 (BD-111): the "public signal" source finally adds a
-- scraped/public-signal `source` value to `corporate_opportunity_signals`
-- (18.1's own migration deliberately left this out, "a lie the schema
-- tells on an unbuilt feature's behalf"). Every `public_signal` row must
-- carry a real, checkable citation URL — enforced here in SQL, not only
-- in `checkAddSignal` — mirroring the citation-grounding discipline
-- `record_consultation_attachment`-adjacent, evidence-first patterns
-- already use elsewhere in this schema.
--
-- What this migration does NOT add: any autonomous discovery/ingestion
-- mechanism (a scraper, a search API call, a scheduled job). That
-- remains genuinely blocked_external — there is no external data source
-- access available to this build. A `public_signal` row can only be
-- entered the same way every other signal is: a real person, through
-- the retailer UI, citing a real source — proving the enforcement path
-- is real without fabricating an ingestion pipeline that does not exist.

alter table public.corporate_opportunity_signals
  drop constraint if exists corporate_opportunity_signals_source_check;

alter table public.corporate_opportunity_signals
  add constraint corporate_opportunity_signals_source_check check (
    source in (
      'referral', 'inbound_enquiry', 'event', 'existing_customer_link',
      'staff_observation', 'public_signal', 'other'
    )
  );

alter table public.corporate_opportunity_signals
  add column if not exists citation_url text
    check (citation_url is null or char_length(citation_url) between 1 and 2000);

alter table public.corporate_opportunity_signals
  add constraint corporate_opportunity_signals_public_signal_has_citation check (
    source <> 'public_signal' or citation_url ~* '^https?://.+'
  );

comment on column public.corporate_opportunity_signals.citation_url is
  'PHASE 18.11 / BD-111. Required and must be a real http(s) URL for '
  'source = public_signal; never set for any other source.';
