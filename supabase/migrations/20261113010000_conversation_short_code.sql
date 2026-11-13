-- Short, guest-friendly conversation ids: 2 letters + 2 digits, e.g. "ab12".
-- NOT applied automatically: review, then run it in the Supabase SQL editor.
-- Run this BEFORE restarting the WhatsApp service with the new code.

alter table conversations add column code text;

alter table conversations
  add constraint conversations_code_format check (code ~ '^[a-z]{2}[0-9]{2}$');

alter table conversations
  add constraint conversations_code_key unique (code);

-- Give every existing conversation a code (67,600 combinations available).
do $$
declare
  r record;
  c text;
begin
  for r in select id from conversations where code is null loop
    loop
      c := chr(97 + floor(random() * 26)::int) || chr(97 + floor(random() * 26)::int) || lpad(floor(random() * 100)::int::text, 2, '0');
      exit when not exists (select 1 from conversations where code = c);
    end loop;
    update conversations set code = c where id = r.id;
  end loop;
end $$;
