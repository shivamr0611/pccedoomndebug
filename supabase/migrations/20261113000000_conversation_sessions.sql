-- Conversation sessions controlled by the guest commands /new and /close.
-- NOT applied automatically: review, then run it in the Supabase SQL editor (or `supabase db push`).

create table guests (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,            -- E.164, e.g. +919876543210
  name text,
  preferred_language text,
  created_at timestamptz not null default now()
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests(id) on delete cascade,
  status text not null default 'open' check (status in ('open','closed')),
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  summary text
);

-- only one open conversation per guest, enforced by the database
create unique index one_open_conversation_per_guest
  on conversations (guest_id) where status = 'open';

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender text not null check (sender in ('guest','ai','staff')),
  body text not null,
  provider_message_id text unique,       -- makes webhook/message retries idempotent
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on messages (conversation_id, created_at);

-- Row Level Security on, with no policies: anon/publishable keys can read and write nothing.
-- The server uses the service role key, which bypasses RLS.
alter table guests enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
