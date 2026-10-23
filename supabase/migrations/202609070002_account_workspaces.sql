-- Additive deployment. Apply both migrations before enabling account clients.
create role isf_workspace_rpc_owner nologin noinherit nobypassrls;
-- Supabase's migration administrator is not a PostgreSQL superuser. Ownership
-- transfer requires SET ROLE membership and temporary CREATE on the schema.
do $$ begin execute format('grant isf_workspace_rpc_owner to %I', current_user); end $$;
grant create on schema individualsavingflow to isf_workspace_rpc_owner;
grant usage on schema individualsavingflow, individualsavingflow_private, auth to isf_workspace_rpc_owner;
grant execute on function auth.uid() to isf_workspace_rpc_owner;
grant execute on all functions in schema individualsavingflow_private to isf_workspace_rpc_owner;

create table individualsavingflow.user_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null default 3 check (schema_version = 3),
  revision bigint not null default 0 check (revision between 0 and 9007199254740991),
  payload jsonb not null check (octet_length(payload::text) <= 1048576),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create table individualsavingflow_private.workspace_mutations (
  user_id uuid not null references auth.users(id) on delete cascade,
  mutation_id uuid not null,
  request_hash bytea not null,
  committed_revision bigint not null check (committed_revision between 0 and 9007199254740991),
  processed_at timestamptz not null default clock_timestamp(),
  primary key (user_id, mutation_id)
);
comment on table individualsavingflow_private.workspace_mutations is 'Successful mutation receipts: retain at least seven days; cleanup is an explicit operator task. No automatic deletion in this migration.';
alter table individualsavingflow.user_workspaces enable row level security;
alter table individualsavingflow.user_workspaces force row level security;
alter table individualsavingflow_private.workspace_mutations enable row level security;
alter table individualsavingflow_private.workspace_mutations force row level security;
revoke all on individualsavingflow.user_workspaces from public, anon, authenticated;
revoke all on individualsavingflow_private.workspace_mutations from public, anon, authenticated;
grant select on individualsavingflow.user_workspaces to authenticated;
grant select, insert, update on individualsavingflow.user_workspaces to isf_workspace_rpc_owner;
grant select, insert on individualsavingflow_private.workspace_mutations to isf_workspace_rpc_owner;
create policy workspace_account_read on individualsavingflow.user_workspaces for select to authenticated
  using ((select auth.uid()) = user_id);
create policy workspace_rpc_access on individualsavingflow.user_workspaces for all to isf_workspace_rpc_owner
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy workspace_receipt_access on individualsavingflow_private.workspace_mutations for all to isf_workspace_rpc_owner
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function individualsavingflow_private.mutate_workspace(operation text, p_payload jsonb, p_expected_revision bigint, p_mutation_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid(); current_row individualsavingflow.user_workspaces; receipt individualsavingflow_private.workspace_mutations;
  request_hash bytea; candidate jsonb; allowed text[]; inserted boolean := false;
begin
  if uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_mutation_id is null or p_payload is null or octet_length(p_payload::text) > 1048576 then
    return jsonb_build_object('status','invalid'); end if;
  if operation <> 'initialize' and (p_expected_revision is null or p_expected_revision < 0 or p_expected_revision > 9007199254740991) then
    return jsonb_build_object('status','invalid'); end if;
  allowed := case operation when 'main' then array['main'] when 'simulation' then array['simulation']
    when 'portfolio' then array['portfolio'] when 'account_map' then array['locations','accountMap']
    when 'initialize' then array['main','simulation','portfolio','locations','accountMap']
    when 'restore' then array['main','simulation','portfolio','locations','accountMap'] else null end;
  if allowed is null or not individualsavingflow_private.exact_keys(p_payload,allowed) then return jsonb_build_object('status','invalid'); end if;
  request_hash := sha256(convert_to(jsonb_build_array(operation,p_expected_revision,p_payload)::text,'UTF8'));

  -- Uniqueness serializes first creation without relying on a pre-existing row lock.
  if operation = 'initialize' then
    select * into current_row from individualsavingflow.user_workspaces where user_id = uid for update;
    if not found then
      candidate := individualsavingflow_private.normalize_workspace(p_payload);
      if candidate is null or octet_length(candidate::text) > 1048576 then return jsonb_build_object('status','invalid'); end if;
      insert into individualsavingflow.user_workspaces(user_id,payload) values(uid,candidate)
        on conflict (user_id) do nothing returning * into current_row;
      inserted := found;
      if not inserted then
        select * into current_row from individualsavingflow.user_workspaces where user_id = uid for update;
      end if;
    end if;
  else
    select * into current_row from individualsavingflow.user_workspaces where user_id = uid for update;
    if not found then return jsonb_build_object('status','conflict'); end if;
  end if;

  select * into receipt from individualsavingflow_private.workspace_mutations where user_id = uid and mutation_id = p_mutation_id;
  if found then
    if receipt.request_hash <> request_hash then return jsonb_build_object('status','invalid'); end if;
    return jsonb_build_object('status','saved','workspace',to_jsonb(current_row),'committed_revision',receipt.committed_revision);
  end if;
  if operation = 'initialize' then
    if not inserted then return jsonb_build_object('status','exists','workspace',to_jsonb(current_row)); end if;
  else
    if current_row.schema_version <> 3 then return jsonb_build_object('status','invalid'); end if;
    if current_row.revision <> p_expected_revision then return jsonb_build_object('status','conflict','workspace',to_jsonb(current_row)); end if;
    if current_row.revision = 9007199254740991 then return jsonb_build_object('status','invalid'); end if;
    candidate := individualsavingflow_private.normalize_workspace(case when operation = 'restore' then p_payload else current_row.payload || p_payload end);
    if candidate is null or octet_length(candidate::text) > 1048576 then return jsonb_build_object('status','invalid'); end if;
    update individualsavingflow.user_workspaces set payload = candidate, revision = revision + 1, updated_at = clock_timestamp()
      where user_id = uid returning * into current_row;
  end if;
  insert into individualsavingflow_private.workspace_mutations(user_id,mutation_id,request_hash,committed_revision)
    values(uid,p_mutation_id,request_hash,current_row.revision);
  return jsonb_build_object('status','saved','workspace',to_jsonb(current_row),'committed_revision',current_row.revision);
end $$;
revoke all on function individualsavingflow_private.mutate_workspace(text,jsonb,bigint,uuid) from public, anon, authenticated;
grant execute on function individualsavingflow_private.mutate_workspace(text,jsonb,bigint,uuid) to isf_workspace_rpc_owner;

create function individualsavingflow.initialize_workspace(p_payload jsonb, p_mutation_id uuid) returns jsonb
language sql security definer set search_path = '' as $$ select individualsavingflow_private.mutate_workspace('initialize',p_payload,null,p_mutation_id) $$;
create function individualsavingflow.save_main(p_payload jsonb, p_mutation_id uuid, p_expected_revision bigint) returns jsonb
language sql security definer set search_path = '' as $$ select individualsavingflow_private.mutate_workspace('main',p_payload,p_expected_revision,p_mutation_id) $$;
create function individualsavingflow.save_simulation(p_payload jsonb, p_mutation_id uuid, p_expected_revision bigint) returns jsonb
language sql security definer set search_path = '' as $$ select individualsavingflow_private.mutate_workspace('simulation',p_payload,p_expected_revision,p_mutation_id) $$;
create function individualsavingflow.save_portfolio(p_payload jsonb, p_mutation_id uuid, p_expected_revision bigint) returns jsonb
language sql security definer set search_path = '' as $$ select individualsavingflow_private.mutate_workspace('portfolio',p_payload,p_expected_revision,p_mutation_id) $$;
create function individualsavingflow.save_account_map(p_payload jsonb, p_mutation_id uuid, p_expected_revision bigint) returns jsonb
language sql security definer set search_path = '' as $$ select individualsavingflow_private.mutate_workspace('account_map',p_payload,p_expected_revision,p_mutation_id) $$;
create function individualsavingflow.restore_workspace(p_payload jsonb, p_mutation_id uuid, p_expected_revision bigint) returns jsonb
language sql security definer set search_path = '' as $$ select individualsavingflow_private.mutate_workspace('restore',p_payload,p_expected_revision,p_mutation_id) $$;

alter function individualsavingflow.initialize_workspace(jsonb,uuid) owner to isf_workspace_rpc_owner;
alter function individualsavingflow.save_main(jsonb,uuid,bigint) owner to isf_workspace_rpc_owner;
alter function individualsavingflow.save_simulation(jsonb,uuid,bigint) owner to isf_workspace_rpc_owner;
alter function individualsavingflow.save_portfolio(jsonb,uuid,bigint) owner to isf_workspace_rpc_owner;
alter function individualsavingflow.save_account_map(jsonb,uuid,bigint) owner to isf_workspace_rpc_owner;
alter function individualsavingflow.restore_workspace(jsonb,uuid,bigint) owner to isf_workspace_rpc_owner;
revoke create on schema individualsavingflow from isf_workspace_rpc_owner;
revoke all on function individualsavingflow.initialize_workspace(jsonb,uuid), individualsavingflow.save_main(jsonb,uuid,bigint),
  individualsavingflow.save_simulation(jsonb,uuid,bigint), individualsavingflow.save_portfolio(jsonb,uuid,bigint),
  individualsavingflow.save_account_map(jsonb,uuid,bigint), individualsavingflow.restore_workspace(jsonb,uuid,bigint) from public, anon;
grant execute on function individualsavingflow.initialize_workspace(jsonb,uuid), individualsavingflow.save_main(jsonb,uuid,bigint),
  individualsavingflow.save_simulation(jsonb,uuid,bigint), individualsavingflow.save_portfolio(jsonb,uuid,bigint),
  individualsavingflow.save_account_map(jsonb,uuid,bigint), individualsavingflow.restore_workspace(jsonb,uuid,bigint) to authenticated;
