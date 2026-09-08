-- Transactional protocol cutover: historical migrations and v3 validators stay intact.
begin;
lock table public.user_workspaces in access exclusive mode;
-- The migration owner is intentionally not BYPASSRLS in the verification harness.
-- The exclusive lock prevents concurrent access until FORCE is restored at commit.
alter table public.user_workspaces no force row level security;
do $$ begin
  if exists (
    select 1 from public.user_workspaces
    where schema_version <> 3 or private.normalize_workspace(payload) is null
  ) then
    raise exception 'workspace v4 upgrade requires valid v3 rows';
  end if;
end $$;

create table private.workspace_schema_backups (
  user_id uuid not null references auth.users(id) on delete cascade,
  schema_version integer not null check (schema_version = 3),
  row_snapshot jsonb not null,
  backed_up_at timestamptz not null default clock_timestamp(),
  primary key (user_id, schema_version)
);
comment on table private.workspace_schema_backups is 'Exact pre-v4 row images for explicit operator recovery. No automatic rollback or deletion; retain until operator review.';
insert into private.workspace_schema_backups(user_id, schema_version, row_snapshot)
  select user_id, schema_version, to_jsonb(w) from public.user_workspaces w;
alter table private.workspace_schema_backups enable row level security;
alter table private.workspace_schema_backups force row level security;
revoke all on private.workspace_schema_backups from public, anon, authenticated, service_role, workspace_rpc_owner;

alter table public.user_workspaces drop constraint user_workspaces_schema_version_check;
update public.user_workspaces set schema_version = 4;
alter table public.user_workspaces alter column schema_version set default 4;
alter table public.user_workspaces add constraint user_workspaces_schema_version_check check (schema_version = 4);
alter table public.user_workspaces force row level security;

-- V4 preserves decomposed custom-name spelling, while comparison_name still uses
-- NFC for duplicate detection. Keep the original v3 normalizer for old-row audits.
create function private.normalize_purpose_state_v4(v jsonb, draft boolean, main jsonb, locations jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare keys text[]; purpose jsonb; link jsonb; loc jsonb; custom jsonb; name text; parent text; role text; pair text;
  customs jsonb := '[]'; customids text[] := '{}'; linkids text[] := '{}'; pairs text[] := '{}'; names text[] := '{}';
  counts jsonb := '{}'; totals jsonb := '{}'; activecounts jsonb := '{}'; remainders text[] := '{}'; amount numeric; mainfield text;
begin
  if v = 'null'::jsonb then return v; end if;
  keys := array['schemaVersion','sourceMainUpdatedAt','customPurposes','links','updatedAt'];
  keys := array_append(keys, case when draft then 'step' else 'setupCompletedAt' end);
  if not private.exact_keys(v, keys) or v->'schemaVersion' <> to_jsonb(case when draft then 1 else 2 end)
    or not private.timestamp_value(v->'sourceMainUpdatedAt') or not private.timestamp_value(v->'updatedAt')
    or (draft and not private.enum_value(v->'step',array['connect','review'])) or (not draft and not private.timestamp_value(v->'setupCompletedAt'))
    or jsonb_typeof(v->'customPurposes') <> 'array' or jsonb_typeof(v->'links') <> 'array'
    or main = 'null'::jsonb or (v->>'sourceMainUpdatedAt')::numeric > (main->>'updatedAt')::numeric then return null; end if;
  for purpose in select value from jsonb_array_elements(v->'customPurposes') loop
    keys := array['id','parentId','name','targetMonthlyWon','createdAt','updatedAt'];
    if purpose ? 'archivedAt' then keys := array_append(keys, 'archivedAt'); end if;
    if not private.exact_keys(purpose, keys) or not private.string_value(purpose->'id') or not starts_with(purpose->>'id','custom:')
      or length(purpose->>'id') <= 7 or not private.enum_value(purpose->'parentId',array['system:housing','system:living','system:saving','system:investing'])
      or not private.string_value(purpose->'name') or not private.integer_value(purpose->'targetMonthlyWon')
      or not private.timestamp_value(purpose->'createdAt') or not private.timestamp_value(purpose->'updatedAt')
      or (purpose ? 'archivedAt' and not private.timestamp_value(purpose->'archivedAt')) or purpose->>'id' = any(customids) then return null; end if;
    name := private.display_name(purpose->>'name');
    if length(name) not between 1 and 24 then return null; end if;
    purpose := jsonb_set(purpose, '{name}', to_jsonb(name)); parent := purpose->>'parentId';
    customids := array_append(customids, purpose->>'id'); customs := customs || jsonb_build_array(purpose);
    if not purpose ? 'archivedAt' then
      pair := jsonb_build_array(parent, private.comparison_name(name))::text;
      if pair = any(names) then return null; end if; names := array_append(names, pair);
      counts := jsonb_set(counts, array[parent], to_jsonb(coalesce((counts->>parent)::integer,0)+1));
      amount := coalesce((totals->>parent)::numeric,0) + (purpose->>'targetMonthlyWon')::numeric;
      totals := jsonb_set(totals, array[parent], to_jsonb(amount));
      if (counts->>parent)::integer > 10 or amount > 9007199254740991 then return null; end if;
      mainfield := case parent when 'system:housing' then 'monthlyHousingWon' when 'system:living' then 'monthlyLivingWon'
        when 'system:saving' then 'monthlySavingWon' else 'monthlyInvestmentWon' end;
      if v->'sourceMainUpdatedAt' = main->'updatedAt' and amount > (main->>mainfield)::numeric then return null; end if;
    end if;
  end loop;
  for link in select value from jsonb_array_elements(v->'links') loop
    keys := array['id','purposeId','locationId','monthlyAmountWon','remainder','status','createdAt','updatedAt'];
    if link ? 'suspendedReason' then keys := array_append(keys,'suspendedReason'); end if;
    if not private.exact_keys(link, keys) or not private.string_value(link->'id') or not private.string_value(link->'purposeId')
      or not private.string_value(link->'locationId') or not private.integer_value(link->'monthlyAmountWon')
      or jsonb_typeof(link->'remainder') <> 'boolean' or not private.timestamp_value(link->'createdAt')
      or not private.timestamp_value(link->'updatedAt') or link->>'id' = any(linkids) then return null; end if;
    if not ((link->'status'='"active"'::jsonb and not link ? 'suspendedReason') or (link->'status'='"suspended"'::jsonb and link->'remainder'='false'::jsonb
      and private.enum_value(link->'suspendedReason',array['location-archived','user']))) then return null; end if;
    parent := link->>'purposeId'; custom := null;
    if parent not in ('system:income','system:housing','system:living','system:saving','system:investing') then
      select value into custom from jsonb_array_elements(customs) where value->>'id'=parent;
      if custom is null then return null; end if; parent := custom->>'parentId';
    end if;
    select value into loc from jsonb_array_elements(locations) where value->>'id'=link->>'locationId';
    if loc is null then return null; end if;
    pair := jsonb_build_array(link->>'purposeId',link->>'locationId')::text;
    if pair = any(pairs) then return null; end if;
    pairs := array_append(pairs,pair); linkids := array_append(linkids,link->>'id');
    if link->>'status'='active' then
      role := case parent when 'system:income' then 'income' when 'system:saving' then 'saving' when 'system:investing' then 'investing' else 'spending' end;
      if loc ? 'archivedAt' or custom ? 'archivedAt' or not (loc->'roles' ? role) then return null; end if;
      parent := link->>'purposeId';
      activecounts := jsonb_set(activecounts,array[parent],to_jsonb(coalesce((activecounts->>parent)::integer,0)+1));
      if (activecounts->>parent)::integer > 10 then return null; end if;
      if link->'remainder'='true'::jsonb then
        if parent = any(remainders) then return null; end if; remainders := array_append(remainders,parent);
      end if;
    end if;
  end loop;
  return jsonb_set(v,'{customPurposes}',customs);
end $$;

create function private.valid_account_transfers_v4(v jsonb, locations jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare transfer jsonb; allocation jsonb; source jsonb; target jsonb; keys text[];
  ids text[] := '{}'; pairs text[] := '{}'; sweeps text[] := '{}'; pair text;
begin
  if jsonb_typeof(v) is distinct from 'array' then return false; end if;
  for transfer in select value from jsonb_array_elements(v) loop
    keys := array['id','sourceLocationId','targetLocationId','allocation','status','createdAt','updatedAt'];
    if transfer ? 'suspendedReason' then keys := array_append(keys,'suspendedReason'); end if;
    if not private.exact_keys(transfer,keys)
      or not private.string_value(transfer->'id')
      or not private.string_value(transfer->'sourceLocationId')
      or not private.string_value(transfer->'targetLocationId')
      or not private.timestamp_value(transfer->'createdAt')
      or not private.timestamp_value(transfer->'updatedAt')
      or transfer->>'id' = any(ids)
      or transfer->>'sourceLocationId' = transfer->>'targetLocationId' then return false; end if;
    if not coalesce(
      (transfer->>'status'='active' and not transfer ? 'suspendedReason')
      or (transfer->>'status'='suspended' and private.enum_value(transfer->'suspendedReason',array['location-archived','user'])),
      false
    ) then return false; end if;
    allocation := transfer->'allocation';
    if not coalesce(
      (private.exact_keys(allocation,array['kind']) and allocation->>'kind'='sweep')
      or (private.exact_keys(allocation,array['kind','monthlyAmountWon']) and allocation->>'kind'='fixed'
        and private.integer_value(allocation->'monthlyAmountWon')),
      false
    ) then return false; end if;
    select value into source from jsonb_array_elements(locations) where value->>'id'=transfer->>'sourceLocationId';
    select value into target from jsonb_array_elements(locations) where value->>'id'=transfer->>'targetLocationId';
    if source is null or target is null then return false; end if;
    ids := array_append(ids,transfer->>'id');
    if transfer->>'status'='active' then
      if source ? 'archivedAt' or target ? 'archivedAt' then return false; end if;
      pair := jsonb_build_array(transfer->>'sourceLocationId',transfer->>'targetLocationId')::text;
      if pair = any(pairs) then return false; end if;
      pairs := array_append(pairs,pair);
      if allocation->>'kind'='sweep' then
        if transfer->>'sourceLocationId' = any(sweeps) then return false; end if;
        sweeps := array_append(sweeps,transfer->>'sourceLocationId');
      end if;
    end if;
  end loop;
  -- UNION (not UNION ALL) bounds reachability and terminates even for a cycle.
  return not exists (
    with recursive edges(source,target) as (
      select value->>'sourceLocationId',value->>'targetLocationId'
      from jsonb_array_elements(v) where value->>'status'='active'
    ), reachable(source,target) as (
      select e.source,e.target from edges e
      union
      select r.source,e.target from reachable r join edges e on r.target=e.source
    )
    select 1 from reachable r where r.source=r.target
  );
end $$;

create function private.normalize_account_map_v4(v jsonb, draft boolean, main jsonb, locations jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare legacy jsonb; normalized jsonb; keys text[];
begin
  if v = 'null'::jsonb then return v; end if;
  if v->'schemaVersion' = to_jsonb(case when draft then 1 else 2 end) then
    return private.normalize_purpose_state_v4(v,draft,main,locations);
  end if;
  keys := array['schemaVersion','sourceMainUpdatedAt','customPurposes','links','transfers','updatedAt'];
  keys := array_append(keys,case when draft then 'step' else 'setupCompletedAt' end);
  if not private.exact_keys(v,keys)
    or v->'schemaVersion' is distinct from to_jsonb(case when draft then 2 else 3 end)
    or (draft and not private.enum_value(v->'step',array['basis','locations','transfers','review']))
    or not private.valid_account_transfers_v4(v->'transfers',locations) then return null; end if;
  legacy := (v - 'transfers') || jsonb_build_object('schemaVersion',case when draft then 1 else 2 end);
  if draft then legacy := legacy || jsonb_build_object('step','connect'); end if;
  normalized := private.normalize_purpose_state_v4(legacy,draft,main,locations);
  if normalized is null then return null; end if;
  normalized := normalized || jsonb_build_object('schemaVersion',v->'schemaVersion','transfers',v->'transfers');
  if draft then normalized := normalized || jsonb_build_object('step',v->'step'); end if;
  return normalized;
end $$;

create function private.normalize_workspace_v4(v jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare locations jsonb; applied jsonb; draft jsonb;
begin
  if not private.exact_keys(v,array['main','simulation','portfolio','locations','accountMap'])
    or not coalesce(private.valid_main(v->'main'),false) or not coalesce(private.valid_simulation(v->'simulation'),false)
    or not coalesce(private.valid_portfolio(v->'portfolio'),false)
    or not private.exact_keys(v->'accountMap',array['applied','draft']) then return null; end if;
  locations := private.normalize_locations(v->'locations'); if locations is null then return null; end if;
  applied := private.normalize_account_map_v4(v#>'{accountMap,applied}',false,v#>'{main,applied}',locations);
  draft := private.normalize_account_map_v4(v#>'{accountMap,draft}',true,v#>'{main,applied}',locations);
  if applied is null or draft is null then return null; end if;
  return v || jsonb_build_object('locations',locations,'accountMap',jsonb_build_object('applied',applied,'draft',draft));
exception when invalid_text_representation or numeric_value_out_of_range then return null;
end $$;
revoke all on function private.normalize_purpose_state_v4(jsonb,boolean,jsonb,jsonb),
  private.valid_account_transfers_v4(jsonb,jsonb), private.normalize_account_map_v4(jsonb,boolean,jsonb,jsonb),
  private.normalize_workspace_v4(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.normalize_purpose_state_v4(jsonb,boolean,jsonb,jsonb),
  private.valid_account_transfers_v4(jsonb,jsonb), private.normalize_account_map_v4(jsonb,boolean,jsonb,jsonb),
  private.normalize_workspace_v4(jsonb) to workspace_rpc_owner;

-- Remove the old entry points; no defaults or alternate arities can admit v3 writers.
drop function public.initialize_workspace(jsonb,uuid);
drop function public.save_main(jsonb,uuid,bigint);
drop function public.save_simulation(jsonb,uuid,bigint);
drop function public.save_portfolio(jsonb,uuid,bigint);
drop function public.save_account_map(jsonb,uuid,bigint);
drop function public.restore_workspace(jsonb,uuid,bigint);
drop function private.mutate_workspace(text,jsonb,bigint,uuid);

create function private.mutate_workspace(operation text, p_payload jsonb, p_expected_revision bigint, p_mutation_id uuid, p_schema_version integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare uid uuid := private.request_uid(); current_row public.user_workspaces; receipt private.workspace_mutations;
  request_hash bytea; candidate jsonb; allowed text[]; inserted boolean := false;
begin
  if uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_schema_version is distinct from 4 or p_mutation_id is null or p_payload is null or octet_length(p_payload::text) > 1048576 then
    return jsonb_build_object('status','invalid'); end if;
  if operation <> 'initialize' and (p_expected_revision is null or p_expected_revision < 0 or p_expected_revision > 9007199254740991) then
    return jsonb_build_object('status','invalid'); end if;
  allowed := case operation when 'main' then array['main'] when 'simulation' then array['simulation']
    when 'portfolio' then array['portfolio'] when 'account_map' then array['locations','accountMap']
    when 'initialize' then array['main','simulation','portfolio','locations','accountMap']
    when 'restore' then array['main','simulation','portfolio','locations','accountMap'] else null end;
  if allowed is null or not private.exact_keys(p_payload,allowed) then return jsonb_build_object('status','invalid'); end if;
  request_hash := sha256(convert_to(jsonb_build_array(p_schema_version,operation,p_expected_revision,p_payload)::text,'UTF8'));

  if operation = 'initialize' then
    select * into current_row from public.user_workspaces where user_id = uid for update;
    if not found then
      candidate := private.normalize_workspace_v4(p_payload);
      if candidate is null or octet_length(candidate::text) > 1048576 then return jsonb_build_object('status','invalid'); end if;
      insert into public.user_workspaces(user_id,payload) values(uid,candidate)
        on conflict (user_id) do nothing returning * into current_row;
      inserted := found;
      if not inserted then select * into current_row from public.user_workspaces where user_id = uid for update; end if;
    end if;
  else
    select * into current_row from public.user_workspaces where user_id = uid for update;
    if not found then return jsonb_build_object('status','conflict'); end if;
  end if;
  if current_row.schema_version <> 4 then return jsonb_build_object('status','invalid'); end if;
  select * into receipt from private.workspace_mutations where user_id = uid and mutation_id = p_mutation_id;
  if found then
    if receipt.request_hash <> request_hash then return jsonb_build_object('status','invalid'); end if;
    return jsonb_build_object('status','saved','workspace',to_jsonb(current_row),'committed_revision',receipt.committed_revision);
  end if;
  if operation = 'initialize' then
    if not inserted then return jsonb_build_object('status','exists','workspace',to_jsonb(current_row)); end if;
  else
    if current_row.revision <> p_expected_revision then return jsonb_build_object('status','conflict','workspace',to_jsonb(current_row)); end if;
    if current_row.revision = 9007199254740991 then return jsonb_build_object('status','invalid'); end if;
    candidate := private.normalize_workspace_v4(case when operation = 'restore' then p_payload else current_row.payload || p_payload end);
    if candidate is null or octet_length(candidate::text) > 1048576 then return jsonb_build_object('status','invalid'); end if;
    update public.user_workspaces set payload = candidate, revision = revision + 1, updated_at = clock_timestamp()
      where user_id = uid returning * into current_row;
  end if;
  insert into private.workspace_mutations(user_id,mutation_id,request_hash,committed_revision)
    values(uid,p_mutation_id,request_hash,current_row.revision);
  return jsonb_build_object('status','saved','workspace',to_jsonb(current_row),'committed_revision',current_row.revision);
end $$;
revoke all on function private.mutate_workspace(text,jsonb,bigint,uuid,integer) from public, anon, authenticated, service_role;
grant execute on function private.mutate_workspace(text,jsonb,bigint,uuid,integer) to workspace_rpc_owner;

create function public.initialize_workspace(p_payload jsonb, p_mutation_id uuid, p_schema_version integer) returns jsonb
language sql security definer set search_path = '' as $$ select private.mutate_workspace('initialize',p_payload,null,p_mutation_id,p_schema_version) $$;
create function public.save_main(p_payload jsonb, p_mutation_id uuid, p_expected_revision bigint, p_schema_version integer) returns jsonb
language sql security definer set search_path = '' as $$ select private.mutate_workspace('main',p_payload,p_expected_revision,p_mutation_id,p_schema_version) $$;
create function public.save_simulation(p_payload jsonb, p_mutation_id uuid, p_expected_revision bigint, p_schema_version integer) returns jsonb
language sql security definer set search_path = '' as $$ select private.mutate_workspace('simulation',p_payload,p_expected_revision,p_mutation_id,p_schema_version) $$;
create function public.save_portfolio(p_payload jsonb, p_mutation_id uuid, p_expected_revision bigint, p_schema_version integer) returns jsonb
language sql security definer set search_path = '' as $$ select private.mutate_workspace('portfolio',p_payload,p_expected_revision,p_mutation_id,p_schema_version) $$;
create function public.save_account_map(p_payload jsonb, p_mutation_id uuid, p_expected_revision bigint, p_schema_version integer) returns jsonb
language sql security definer set search_path = '' as $$ select private.mutate_workspace('account_map',p_payload,p_expected_revision,p_mutation_id,p_schema_version) $$;
create function public.restore_workspace(p_payload jsonb, p_mutation_id uuid, p_expected_revision bigint, p_schema_version integer) returns jsonb
language sql security definer set search_path = '' as $$ select private.mutate_workspace('restore',p_payload,p_expected_revision,p_mutation_id,p_schema_version) $$;
grant create on schema public to workspace_rpc_owner;
alter function public.initialize_workspace(jsonb,uuid,integer) owner to workspace_rpc_owner;
alter function public.save_main(jsonb,uuid,bigint,integer) owner to workspace_rpc_owner;
alter function public.save_simulation(jsonb,uuid,bigint,integer) owner to workspace_rpc_owner;
alter function public.save_portfolio(jsonb,uuid,bigint,integer) owner to workspace_rpc_owner;
alter function public.save_account_map(jsonb,uuid,bigint,integer) owner to workspace_rpc_owner;
alter function public.restore_workspace(jsonb,uuid,bigint,integer) owner to workspace_rpc_owner;
revoke create on schema public from workspace_rpc_owner;
revoke all on function public.initialize_workspace(jsonb,uuid,integer), public.save_main(jsonb,uuid,bigint,integer),
  public.save_simulation(jsonb,uuid,bigint,integer), public.save_portfolio(jsonb,uuid,bigint,integer),
  public.save_account_map(jsonb,uuid,bigint,integer), public.restore_workspace(jsonb,uuid,bigint,integer) from public, anon, service_role;
grant execute on function public.initialize_workspace(jsonb,uuid,integer), public.save_main(jsonb,uuid,bigint,integer),
  public.save_simulation(jsonb,uuid,bigint,integer), public.save_portfolio(jsonb,uuid,bigint,integer),
  public.save_account_map(jsonb,uuid,bigint,integer), public.restore_workspace(jsonb,uuid,bigint,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
