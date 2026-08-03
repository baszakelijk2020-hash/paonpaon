-- Honeymoon Phase expansion: a first-order customer may explicitly choose
-- to defer payment to collection instead of paying online now. This is
-- not a new payment-capture mechanism — checkout already leaves every
-- order at `pending_payment` until Stripe Checkout succeeds or staff use
-- the existing `markPaidInStore` action; this column only records that
-- the customer made an explicit, honest choice not to be charged online,
-- so retailer staff stop expecting an online payment and collect at
-- fitting/delivery instead. Existing UPDATE grant (service_role only, from
-- 20260801000002) already covers writing this column — no new grant or
-- RLS policy needed.

alter table public.honeymoon_programmes
  add column pay_at_delivery boolean not null default false;

comment on column public.honeymoon_programmes.pay_at_delivery is
  'Customer chose to pay at collection/delivery instead of online now — see HoneymoonProgrammeRepository.setPayAtDelivery. Never set true by the platform on its own.';
