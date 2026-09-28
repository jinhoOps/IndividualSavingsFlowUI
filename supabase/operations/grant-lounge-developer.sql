-- Run as the database operator after migration 202609280011.
-- The user explicitly confirmed this existing account; never create a new one.
begin;
do $$
declare developer_id uuid;
begin
  select id into strict developer_id from auth.users
    where lower(email)='okho04@gmail.com' and email_confirmed_at is not null;
  insert into private.lounge_developers(user_id) values(developer_id) on conflict(user_id) do nothing;
end $$;
commit;
