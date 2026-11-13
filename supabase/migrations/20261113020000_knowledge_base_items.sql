-- Editable property knowledge used by the admin UI and WhatsApp assistant.
-- Apply this migration in the Supabase SQL editor or with `supabase db push`.

create table if not exists public.knowledge_base_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (char_length(trim(category)) between 1 and 80),
  title text not null check (char_length(trim(title)) between 1 and 160),
  content text not null check (char_length(trim(content)) between 1 and 5000),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_base_items_enabled_category_idx
  on public.knowledge_base_items (enabled, category, title);

alter table public.knowledge_base_items enable row level security;
