-- FT-14 HighMaintenance: the customer sees a deliberately small projection
-- of their booking-linked garment care. Partner contacts, instructions,
-- condition notes, staff identity and commercial records remain staff-only.

create or replace function public.get_my_service_care_status()
returns table (
  booking_id uuid,
  garment_display_name text,
  capability text,
  due_on date,
  custody_state text,
  returned_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    booking.id,
    coalesce(
      wardrobe_item.display_name,
      nullif(btrim(physical_garment.brand || ' ' || physical_garment.garment_type), ''),
      physical_garment.garment_type,
      'Your garment'
    ) as garment_display_name,
    engagement.capability,
    engagement.due_on,
    engagement.custody_state,
    engagement.returned_on
  from public.service_partner_engagements as engagement
  join public.customers as customer
    on customer.id = engagement.customer_id
    and customer.retailer_id = engagement.retailer_id
    and customer.deleted_at is null
  join public.service_bookings as booking
    on booking.id = engagement.booking_id
    and booking.customer_id = engagement.customer_id
    and booking.retailer_id = engagement.retailer_id
  left join public.wardrobe_items as wardrobe_item
    on wardrobe_item.id = engagement.wardrobe_item_id
    and wardrobe_item.customer_id = engagement.customer_id
    and wardrobe_item.retailer_id = engagement.retailer_id
    and wardrobe_item.deleted_at is null
  left join public.physical_garments as physical_garment
    on physical_garment.id = engagement.physical_garment_id
    and physical_garment.customer_id = engagement.customer_id
    and physical_garment.retailer_id = engagement.retailer_id
    and physical_garment.deleted_at is null
  where customer.user_id = (select auth.uid())
    and engagement.booking_id is not null
    and engagement.deleted_at is null
  order by engagement.due_on asc, engagement.created_at asc;
$$;

revoke all on function public.get_my_service_care_status() from public;
grant execute on function public.get_my_service_care_status()
  to authenticated, service_role;

comment on function public.get_my_service_care_status() is
  'FT-14 customer-safe HighMaintenance projection. Derives the caller from auth.uid(); never exposes partner, instructions, condition notes, cost or staff data.';
