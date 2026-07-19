-- Local development seed data only. Never run against a production
-- project. See docs/DATABASE.md "Local development".

insert into public.retailers
  (legal_name, display_name, slug, status, tier, default_currency, default_locale)
values
  ('Atelier Demo, Inc.', 'Atelier Demo', 'atelier-demo', 'active', 'house', 'USD', 'en-US')
on conflict (slug) do nothing;
