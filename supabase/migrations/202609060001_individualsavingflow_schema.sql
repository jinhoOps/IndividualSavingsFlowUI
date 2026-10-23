-- ISF lives in the shared github-jinhoOps project under its own schemas.
-- individualsavingflow is the API schema (exposed by PostgREST); individualsavingflow_private
-- (created by the next migration) holds helpers and is never exposed.
-- Supabase sets these defaults on public only, so the API schema mirrors them here.
create schema if not exists individualsavingflow;
grant usage on schema individualsavingflow to anon, authenticated, service_role;
alter default privileges in schema individualsavingflow grant all on tables to anon, authenticated, service_role;
alter default privileges in schema individualsavingflow grant all on functions to anon, authenticated, service_role;
alter default privileges in schema individualsavingflow grant all on sequences to anon, authenticated, service_role;
