create policy "customer creates own wedding party" on public.wedding_parties
  for insert
  with check (
    exists (
      select 1 from public.customers c
      where c.id = wedding_parties.organizer_customer_id
        and c.user_id = auth.uid()
        and c.retailer_id = wedding_parties.retailer_id
    )
  );
