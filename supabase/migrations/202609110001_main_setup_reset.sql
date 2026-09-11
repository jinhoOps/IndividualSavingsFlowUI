begin;

-- Explicit reset only. Ordinary Main saves must still preserve assistant history.
create function private.reset_main_setup(current_main jsonb, requested_main jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare applied jsonb:=current_main->'applied'; expected jsonb; stamp jsonb:=requested_main#>'{setupProgress,savedAt}';
begin
  if applied is null or applied='null'::jsonb or not coalesce(private.timestamp_value(stamp),false) then return null; end if;
  expected:=current_main || jsonb_build_object('expenseAssistant',null,'setupProgress',jsonb_build_object(
    'kind','restart','step','welcome','savedAt',stamp,'draft',applied || jsonb_build_object(
      'monthlyNetIncomeWon',0,'monthlyHousingWon',0,'monthlyLivingWon',0,'monthlySavingWon',0,'monthlyInvestmentWon',0)));
  if requested_main is distinct from expected then return null; end if;
  return expected;
end $$;
revoke all on function private.reset_main_setup(jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.reset_main_setup(jsonb,jsonb) to workspace_rpc_owner;

create or replace function private.mutate_workspace(operation text, p_payload jsonb, p_expected_revision bigint, p_mutation_id uuid, p_schema_version integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare uid uuid := private.request_uid(); current_row public.user_workspaces; receipt private.workspace_mutations;
  request_hash bytea; candidate jsonb; allowed text[]; inserted boolean := false;
begin
  if uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_schema_version is distinct from 5 or p_mutation_id is null or p_payload is null or octet_length(p_payload::text) > 1048576 then
    return jsonb_build_object('status','invalid'); end if;
  if operation <> 'initialize' and (p_expected_revision is null or p_expected_revision < 0 or p_expected_revision > 9007199254740991) then
    return jsonb_build_object('status','invalid'); end if;
  allowed := case operation when 'main_reset' then array['main'] when 'main' then array['main'] when 'expense_draft' then array['main'] when 'expense_apply' then array['main'] when 'simulation' then array['simulation']
    when 'portfolio' then array['portfolio'] when 'account_map' then array['locations','accountMap']
    when 'initialize' then array['main','simulation','portfolio','locations','accountMap']
    when 'restore' then array['main','simulation','portfolio','locations','accountMap'] else null end;
  if allowed is null or not private.exact_keys(p_payload,allowed) then return jsonb_build_object('status','invalid'); end if;
  request_hash := sha256(convert_to(jsonb_build_array(p_schema_version,operation,p_expected_revision,p_payload)::text,'UTF8'));

  if operation = 'initialize' then
    select * into current_row from public.user_workspaces where user_id = uid for update;
    if not found then
      candidate := private.normalize_workspace_v5(p_payload);
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
  if current_row.schema_version <> 5 then return jsonb_build_object('status','invalid'); end if;
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
    if operation in ('expense_draft','expense_apply') then
      candidate:=private.expense_main(current_row.payload->'main',p_payload->'main',operation='expense_apply');
      if candidate is null then return jsonb_build_object('status','invalid'); end if;
      candidate:=private.normalize_workspace_v5(current_row.payload || jsonb_build_object('main',candidate));
    elsif operation='main_reset' then
      candidate:=private.reset_main_setup(current_row.payload->'main',p_payload->'main');
      if candidate is null then return jsonb_build_object('status','invalid'); end if;
      candidate:=private.normalize_workspace_v5(current_row.payload || jsonb_build_object('main',candidate));
    elsif operation='main' then
      -- Ordinary Main editing cannot change or remove remembered expense answers.
      if p_payload#>'{main,expenseAssistant}' is distinct from current_row.payload#>'{main,expenseAssistant}' then return jsonb_build_object('status','invalid'); end if;
      candidate:=private.normalize_workspace_v5(current_row.payload || p_payload);
    else
      candidate:=private.normalize_workspace_v5(case when operation='restore' then p_payload else current_row.payload || p_payload end);
    end if;
    if candidate is null or octet_length(candidate::text) > 1048576 then return jsonb_build_object('status','invalid'); end if;
    update public.user_workspaces set payload = candidate, revision = revision + 1, updated_at = clock_timestamp()
      where user_id = uid returning * into current_row;
  end if;
  insert into private.workspace_mutations(user_id,mutation_id,request_hash,committed_revision)
    values(uid,p_mutation_id,request_hash,current_row.revision);
  return jsonb_build_object('status','saved','workspace',to_jsonb(current_row),'committed_revision',current_row.revision);
end $$;

create function public.reset_main_setup(p_payload jsonb,p_mutation_id uuid,p_expected_revision bigint,p_schema_version integer) returns jsonb
language sql security definer set search_path='' as $$ select private.mutate_workspace('main_reset',p_payload,p_expected_revision,p_mutation_id,p_schema_version) $$;
grant create on schema public to workspace_rpc_owner;
alter function public.reset_main_setup(jsonb,uuid,bigint,integer) owner to workspace_rpc_owner;
revoke create on schema public from workspace_rpc_owner;
revoke all on function public.reset_main_setup(jsonb,uuid,bigint,integer) from public,anon,service_role;
grant execute on function public.reset_main_setup(jsonb,uuid,bigint,integer) to authenticated;
notify pgrst,'reload schema';
commit;
