alter table public.room_bookings
  add column if not exists guest_phone text,
  add column if not exists guest_name text,
  add column if not exists amount_inr numeric(10, 2),
  add column if not exists mock_transaction_id text,
  add column if not exists payment_reference text,
  add column if not exists payment_status text not null default 'manual';

create unique index if not exists room_bookings_payment_reference_idx
  on public.room_bookings (payment_reference)
  where payment_reference is not null;
