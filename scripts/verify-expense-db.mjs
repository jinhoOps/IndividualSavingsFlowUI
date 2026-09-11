import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {assistant, answers, expenseFixtures} from '../supabase/tests/expense-fixtures.mjs';

/** Runs inside test-workspace-db's disposable database after its historical v4 gates. */
export async function verifyExpenseDatabase({sql, quote, asUser, vite, userA, userC}) {
  const migration = await readFile(new URL('../supabase/migrations/202609100001_workspace_v5_expense_assistant.sql',import.meta.url),'utf8');
  const before = JSON.parse(sql('select jsonb_agg(to_jsonb(w) order by user_id) from public.user_workspaces w'));
  // A late migration error must roll back both metadata and before-images.
  sql("create function private.expense_item_ids() returns text[] language sql as 'select array[]::text[]'");
  assert.throws(()=>sql(`set role migration_admin; ${migration}`),/already exists/);
  assert.deepEqual(JSON.parse(sql('select jsonb_agg(to_jsonb(w) order by user_id) from public.user_workspaces w')),before);
  assert.equal(sql('select count(*) from private.workspace_schema_backups where schema_version=4'),'0');
  sql('drop function private.expense_item_ids()');
  sql(`set role migration_admin; ${migration}`);
  for (const row of before) {
    const after = JSON.parse(sql(`select to_jsonb(w) from public.user_workspaces w where user_id='${row.user_id}'`));
    assert.equal(after.schema_version,5);
    assert.equal(after.payload.main.expenseAssistant,null);
    delete after.payload.main.expenseAssistant;
    assert.deepEqual({...after,schema_version:4},row,'migration preserves every amount, slice, revision and timestamp');
    assert.deepEqual(JSON.parse(sql(`select row_snapshot from private.workspace_schema_backups where user_id='${row.user_id}' and schema_version=4`)),row);
  }
  const {parseExpenseAssistant,expenseTotals} = await vite.ssrLoadModule('/src/main/domain/expenseAssistant.ts');
  const {parseWorkspaceDocument} = await vite.ssrLoadModule('/src/workspace/domain/validation.ts');
  const rpc = (name,payload,revision,id=randomUUID(),user=userA,schema=5) => JSON.parse(sql(asUser(`select public.${name}(${quote(payload)},'${id}',${revision},${schema})`,user)));
  let row = JSON.parse(sql(asUser('select to_jsonb(w) from public.user_workspaces w')));
  for (const fixture of expenseFixtures) {
    assert.equal(parseExpenseAssistant(fixture.value)!==null,fixture.valid,fixture.name);
    assert.equal(sql(`select coalesce(private.valid_expense_assistant(${quote(fixture.value)}),false)`),fixture.valid?'t':'f',fixture.name);
    const payload={...row.payload,main:{...row.payload.main,expenseAssistant:fixture.value}};
    assert.equal(parseWorkspaceDocument({...payload,schemaVersion:5,revision:0,updatedAt:1000})!==null,fixture.valid);
    assert.equal(sql(`select private.normalize_workspace_v5(${quote(payload)}) is not null`),fixture.valid?'t':'f');
  }
  assert.deepEqual(JSON.parse(sql(`select private.expense_totals(${quote(answers)},true)`)),expenseTotals(answers));
  const annual=structuredClone(answers); for(const a of Object.values(annual)){a.amountWon=0;a.period='year';}
  annual.rent.amountWon=5;annual.utilities.amountWon=5;annual.food.amountWon=6;
  assert.deepEqual(expenseTotals(annual),{housingWon:1,livingWon:1,totalWon:2});
  assert.deepEqual(JSON.parse(sql(`select private.expense_totals(${quote(annual)},true)`)),expenseTotals(annual),'round once per destination');

  const original=structuredClone(row.payload);
  const request={main:{...row.payload.main,expenseAssistant:assistant}};
  assert.equal(rpc('save_expense_draft',request,row.revision,randomUUID(),userA,4).status,'invalid');
  assert.equal(rpc('save_main',{main:row.payload.main},row.revision,randomUUID(),userA,4).status,'invalid','old Main writes cannot erase answers');
  let result=rpc('save_expense_draft',request,row.revision);
  assert.equal(result.status,'saved'); row=result.workspace;
  assert.deepEqual(row.payload.main.applied,original.main.applied,'draft save never changes Main totals or timestamp');
  assert.equal(row.payload.main.expenseAssistant.lastApplied,null);
  const partial=structuredClone(request);partial.main.expenseAssistant.draft.answers.rent=null;
  assert.equal(rpc('apply_expense',partial,row.revision).status,'invalid');
  const mutation=randomUUID();
  result=rpc('apply_expense',request,row.revision,mutation);
  assert.equal(result.status,'saved'); const applied=result.workspace;
  assert.equal(applied.payload.main.applied.monthlyHousingWon,835000);
  assert.equal(applied.payload.main.applied.monthlyLivingWon,860000);
  for(const field of ['monthlyNetIncomeWon','monthlySavingWon','monthlyInvestmentWon']) assert.equal(applied.payload.main.applied[field],original.main.applied[field]);
  for(const key of ['simulation','portfolio','locations','accountMap']) assert.deepEqual(applied.payload[key],original[key]);
  assert.deepEqual(applied.payload.main.expenseAssistant.lastApplied.answers,answers);
  assert.equal(rpc('apply_expense',request,row.revision,mutation).workspace.revision,applied.revision,'retry is idempotent');
  assert.equal(rpc('apply_expense',request,row.revision).status,'conflict','stale revision cannot apply');
  row=applied;
  const manual=structuredClone(row.payload.main);manual.applied.monthlyLivingWon=999999;manual.applied.monthlySavingWon=777777;manual.applied.updatedAt++;
  result=rpc('save_main',{main:manual},row.revision);assert.equal(result.status,'saved');row=result.workspace;
  assert.deepEqual(row.payload.main.expenseAssistant.lastApplied.answers,answers,'direct editing remembers answers');
  const forget=structuredClone(manual);forget.expenseAssistant=null;
  assert.equal(rpc('save_main',{main:forget},row.revision).status,'invalid','ordinary edit cannot remove details');
  result=rpc('apply_expense',request,row.revision);assert.equal(result.status,'saved');row=result.workspace;
  assert.equal(row.payload.main.applied.monthlyLivingWon,860000,'completion replaces the manual estimate again');
  assert.equal(row.payload.main.applied.monthlySavingWon,777777,'even an old completion payload preserves latest saving');
  assert.equal(rpc('save_expense_draft',request,row.revision,randomUUID(),userC).status,'conflict','caller cannot address another account');
  for(const name of ['save_expense_draft','apply_expense']) {
    assert.throws(()=>sql(asUser(`select public.${name}(${quote(request)},gen_random_uuid(),${row.revision},5)`,'','anon')),/permission denied/);
    assert.equal(sql(`select prosecdef and proowner='workspace_rpc_owner'::regrole and proconfig @> array['search_path=""'] from pg_proc where oid='public.${name}(jsonb,uuid,bigint,integer)'::regprocedure`),'t');
  }
  const beforeFailure=sql(asUser('select to_jsonb(w) from public.user_workspaces w'));
  sql("create function private.reject_expense_receipt() returns trigger language plpgsql as $$ begin raise exception 'expense receipt failure'; end $$; create trigger reject_expense_receipt before insert on private.workspace_mutations for each row execute function private.reject_expense_receipt()");
  assert.throws(()=>rpc('apply_expense',request,row.revision),/expense receipt failure/);
  assert.equal(sql(asUser('select to_jsonb(w) from public.user_workspaces w')),beforeFailure,'totals and answers roll back together');
  sql('drop trigger reject_expense_receipt on private.workspace_mutations; drop function private.reject_expense_receipt()');
  const resetMigration = await readFile(new URL('../supabase/migrations/202609110001_main_setup_reset.sql', import.meta.url), 'utf8');
  const beforeResetMigration = sql('select jsonb_agg(to_jsonb(w) order by user_id) from public.user_workspaces w');
  sql(`set role migration_admin; ${resetMigration}`);
  assert.equal(sql('select jsonb_agg(to_jsonb(w) order by user_id) from public.user_workspaces w'), beforeResetMigration, 'reset migration does not modify stored data');
  const {withMainSetupReset} = await vite.ssrLoadModule('/src/main/infrastructure/mainSetupReset.ts');
  const resetPayload = {main: withMainSetupReset({...row.payload}, 2000).main};
  const resetId = randomUUID();
  assert.equal(rpc('reset_main_setup',resetPayload,row.revision,randomUUID(),userA,4).status,'invalid');
  const badReset = structuredClone(resetPayload); badReset.main.setupProgress.draft.monthlyHousingWon=1;
  assert.equal(rpc('reset_main_setup',badReset,row.revision).status,'invalid','reset must use an empty draft');
  const badApplied = structuredClone(resetPayload); badApplied.main.applied.monthlySavingWon=0;
  assert.equal(rpc('reset_main_setup',badApplied,row.revision).status,'invalid','reset cannot change the applied plan');
  assert.equal(rpc('reset_main_setup',{...resetPayload,simulation:row.payload.simulation},row.revision).status,'invalid');
  assert.throws(()=>sql(asUser(`select public.reset_main_setup(${quote(resetPayload)},gen_random_uuid(),${row.revision},5)`,'','anon')),/permission denied/);
  assert.equal(rpc('reset_main_setup',resetPayload,row.revision,randomUUID(),userC).status,'conflict');
  const beforeResetFailure = sql(asUser('select to_jsonb(w) from public.user_workspaces w'));
  sql("create function private.reject_reset_receipt() returns trigger language plpgsql as $$ begin raise exception 'reset receipt failure'; end $$; create trigger reject_reset_receipt before insert on private.workspace_mutations for each row execute function private.reject_reset_receipt()");
  assert.throws(()=>rpc('reset_main_setup',resetPayload,row.revision),/reset receipt failure/);
  assert.equal(sql(asUser('select to_jsonb(w) from public.user_workspaces w')),beforeResetFailure,'failed reset rolls back both progress and assistant deletion');
  sql('drop trigger reject_reset_receipt on private.workspace_mutations; drop function private.reject_reset_receipt()');
  const beforeReset = structuredClone(row);
  result=rpc('reset_main_setup',resetPayload,row.revision,resetId);
  assert.equal(result.status,'saved');
  assert.deepEqual(result.workspace.payload.main,resetPayload.main);
  for(const key of ['simulation','portfolio','locations','accountMap']) assert.deepEqual(result.workspace.payload[key],beforeReset.payload[key]);
  assert.equal(result.workspace.payload.main.expenseAssistant,null,'draft answers and lastApplied history are removed together');
  assert.equal(rpc('reset_main_setup',resetPayload,row.revision,resetId).workspace.revision,result.workspace.revision,'reset retry is idempotent');
  assert.equal(rpc('reset_main_setup',resetPayload,row.revision).status,'conflict');
  row=result.workspace;
  console.log('PASS: explicit Main reset migration retention, empty draft + assistant removal, applied/other-slice preservation, schema/auth, CAS and receipt replay.');
  console.log(`PASS: workspace v5 before-images/rollback; ${expenseFixtures.length} expense TS/SQL fixtures; server totals, rounding, remembered drafts, replacement, retry/CAS, latest Main preservation, atomicity and RLS.`);
}
