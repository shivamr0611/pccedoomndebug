-- One row represents one occupied room on one calendar date.
-- The admin backend uses the service-role key; unoccupied rooms have no row.

create table if not exists public.room_bookings (
  booking_date date not null,
  room_number smallint not null check (room_number between 101 and 109),
  created_at timestamptz not null default now(),
  primary key (booking_date, room_number)
);

alter table public.room_bookings enable row level security;
