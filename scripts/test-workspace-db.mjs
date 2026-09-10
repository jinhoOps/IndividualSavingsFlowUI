import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createServer } from 'vite';
import { empty, full, flow, fixtures } from '../supabase/tests/workspace-fixtures.mjs';

// A disposable local database only. No connection string or remote database is accepted.
const container = `isf-workspace-test-${randomUUID()}`;
const exec = promisify(execFile);
const docker = args => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const sql = statement => docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', statement]);
const quote = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const userA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const userC = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const legacyUser = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const asUser = (statement, user = userA, role = 'authenticated') => `set role ${role}; set request.jwt.claims = '${JSON.stringify({ ...(user ? { sub: user } : {}), role })}'; ${statement}`;
const call = (name, payload, revision, mutation = randomUUID(), user = userA, schema = 4) => asUser(`select public.${name}(p_payload => ${quote(payload)}, p_mutation_id => '${mutation}'::uuid${revision === undefined ? '' : `, p_expected_revision => ${revision}`}, p_schema_version => ${schema});`, user);
const rpc = (...args) => JSON.parse(sql(call(...args)));
let vite;
try {
  docker(['run', '-d', '--rm', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17']);
  for (let attempt = 0; attempt < 100; attempt++) {
    try { docker(['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  sql(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create schema auth;
    create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
    grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
    insert into auth.users values ('${userA}'), ('${userB}'), ('${userC}'), ('${legacyUser}');
    create role migration_admin nologin createrole createdb;
    grant create on database postgres to migration_admin;
    grant all on schema public to migration_admin with grant option;
    -- Hosted postgres can use auth but cannot grant its schema to custom roles.
    grant usage on schema auth to migration_admin;
    grant execute on function auth.uid() to migration_admin;
    alter default privileges for role migration_admin grant execute on functions to anon, authenticated, service_role;
    grant references on auth.users to migration_admin;`);
  const migrations = await readdir(new URL('../supabase/migrations/', import.meta.url)).catch(() => []);
  const orderedMigrations = migrations.filter(f => f.endsWith('.sql')).sort();
  for (const file of orderedMigrations.filter(f => f < '202609080002')) sql(`set role migration_admin; ${await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8')}`);
  const legacyMutation = randomUUID();
  sql(asUser(`select public.initialize_workspace(${quote(full)}, '${randomUUID()}'::uuid);`, legacyUser));
  sql(asUser(`select public.save_main(${quote({ main: full.main })}, '${legacyMutation}'::uuid, 0);`, legacyUser));
  // Valid older data need not have canonical whitespace. Cutover must not rewrite it.
  sql(`update public.user_workspaces set payload=${quote(full)} where user_id='${legacyUser}'`);
  const legacyRow = JSON.parse(sql(`select to_jsonb(w) from public.user_workspaces w where user_id='${legacyUser}'`));
  const legacyReceipts = sql(`select jsonb_agg(to_jsonb(r) order by mutation_id) from private.workspace_mutations r where user_id='${legacyUser}'`);
  const v4Migration = await readFile(new URL('../supabase/migrations/202609080002_workspace_v4.sql', import.meta.url), 'utf8');
  const verifyUpgradeRollback = () => {
    assert.deepEqual(JSON.parse(sql(`select to_jsonb(w) from public.user_workspaces w where user_id='${legacyUser}'`)), legacyRow);
    assert.equal(sql(`select jsonb_agg(to_jsonb(r) order by mutation_id) from private.workspace_mutations r where user_id='${legacyUser}'`), legacyReceipts);
    assert.equal(sql("select to_regclass('private.workspace_schema_backups') is null"), 't', 'failed upgrade leaves no partial backup table');
    assert.equal(sql("select relrowsecurity and relforcerowsecurity from pg_class where oid='public.user_workspaces'::regclass"), 't', 'failed upgrade restores FORCE RLS');
  };
  sql(`insert into public.user_workspaces(user_id,payload) values ('${userB}','{}')`);
  assert.throws(() => sql(`set role migration_admin; ${v4Migration}`), /requires valid v3 rows/, 'corruption blocks the complete cutover');
  verifyUpgradeRollback();
  sql(`delete from public.user_workspaces where user_id='${userB}'`);
  // Deliberately fail after the metadata UPDATE to prove the whole migration rolls back.
  sql("create function private.normalize_workspace_v4(jsonb) returns jsonb language sql as 'select $1'");
  assert.throws(() => sql(`set role migration_admin; ${v4Migration}`), /already exists/, 'late migration failure must roll back before-images and metadata');
  verifyUpgradeRollback();
  sql('drop function private.normalize_workspace_v4(jsonb)');
  for (const file of orderedMigrations.filter(f => f >= '202609080002' && f < '202609100001')) sql(`set role migration_admin; ${await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8')}`);
  const upgradedRow = JSON.parse(sql(`select to_jsonb(w) from public.user_workspaces w where user_id='${legacyUser}'`));
  assert.equal(upgradedRow.schema_version, 4, 'existing v3 rows must upgrade to v4');
  assert.deepEqual({ ...upgradedRow, schema_version: 3 }, legacyRow, 'upgrade must preserve payload, revision and timestamps exactly');
  assert.equal(sql(`select jsonb_agg(to_jsonb(r) order by mutation_id) from private.workspace_mutations r where user_id='${legacyUser}'`), legacyReceipts, 'upgrade retains every receipt unchanged');
  assert.deepEqual(JSON.parse(sql(`select row_snapshot from private.workspace_schema_backups where user_id='${legacyUser}' and schema_version=3`)), legacyRow, 'retain exact before-image');
  assert.equal(rpc('save_main', { main: full.main }, 0, legacyMutation, legacyUser).status, 'invalid', 'old receipt cannot authorize a v4 request');
  for (const name of ['initialize_workspace', 'save_main', 'save_simulation', 'save_portfolio', 'save_account_map', 'restore_workspace']) {
    const args = name === 'initialize_workspace' ? `'{}'::jsonb, gen_random_uuid()` : `'{}'::jsonb, gen_random_uuid(), 0`;
    assert.throws(() => sql(asUser(`select public.${name}(${args})`)), /does not exist/, 'old clients have no callable overload');
    const payload = name === 'save_main' ? { main: full.main }
      : name === 'save_simulation' ? { simulation: full.simulation }
      : name === 'save_portfolio' ? { portfolio: full.portfolio }
      : name === 'save_account_map' ? { locations: full.locations, accountMap: full.accountMap } : full;
    for (const schema of [3, 5, 'null']) assert.equal(rpc(name, payload, name === 'initialize_workspace' ? undefined : 1, randomUUID(), legacyUser, schema).status, 'invalid', 'valid writes still require schema 4');
  }
  assert.deepEqual(JSON.parse(sql(`select to_jsonb(w) from public.user_workspaces w where user_id='${legacyUser}'`)), upgradedRow, 'blocked legacy calls cannot overwrite upgraded data');
  for (const role of ['anon', 'authenticated', 'service_role', 'workspace_rpc_owner']) {
    assert.throws(() => sql(`set role ${role}; select * from private.workspace_schema_backups`), /permission denied/);
  }
  assert.equal(sql("select relrowsecurity and relforcerowsecurity from pg_class where oid='private.workspace_schema_backups'::regclass"), 't');
  assert.equal(sql("select relrowsecurity and relforcerowsecurity from pg_class where oid='public.user_workspaces'::regclass"), 't');
  assert.equal(sql("select has_table_privilege('migration_admin','private.workspace_schema_backups','SELECT')"), 't');
  assert.equal(sql('set role migration_admin; select count(*) from private.workspace_schema_backups'), '0', 'FORCE RLS hides before-images even from the ordinary owner');
  assert.equal(sql("select to_regclass('public.user_workspaces') is not null"), 't', 'workspace persistence migration must create storage');
  assert.equal(sql("select has_schema_privilege('migration_admin','auth','USAGE WITH GRANT OPTION')"), 'f', 'reproduce hosted migration administrator permissions');
  assert.equal(sql("select has_schema_privilege('workspace_rpc_owner','auth','USAGE')"), 'f', 'RPCs must not depend on inaccessible managed auth schema');
  assert.throws(() => sql('set role workspace_rpc_owner; select auth.uid()'), /permission denied for schema auth/);
  for (const { sub, claims, expected } of [
    { claims: `{"sub":"${userA}"}`, expected: userA },
    { sub: userB, claims: `{"sub":"${userA}"}`, expected: userB },
    { sub: '', claims: `{"sub":"${userA}"}`, expected: userA },
    { expected: 'missing' },
    { sub: '', claims: '', expected: 'missing' },
    { claims: '{}', expected: 'missing' },
    { claims: '{"sub":null}', expected: 'missing' },
  ]) {
    const settings = `${sub === undefined ? '' : `set request.jwt.claim.sub = '${sub}';`}
      ${claims === undefined ? '' : `set request.jwt.claims = '${claims}';`}`;
    assert.equal(sql(`set role workspace_rpc_owner; ${settings} select coalesce(private.request_uid()::text,'missing')`), expected, 'trusted request UID follows Supabase claim precedence and missing-value behavior');
  }
  for (const claims of ['invalid-json', '{"sub":"invalid-uuid"}', '{"sub":""}']) {
    assert.throws(() => sql(`set role workspace_rpc_owner; set request.jwt.claims = '${claims}'; select private.request_uid()`), /invalid input syntax/, 'malformed claims must not become a valid identity');
  }
  assert.equal(sql("select prosecdef from pg_proc where oid='private.request_uid()'::regprocedure"), 'f', 'request identity reader must not elevate privileges');
  for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.equal(sql(`select has_function_privilege('${role}','private.request_uid()','EXECUTE')`), 'f', 'only the RPC owner may call the private request identity reader');
  }
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  const { parseWorkspaceV4Document: parseWorkspaceDocument } = await vite.ssrLoadModule('/src/workspace/domain/validation.ts');
  for (const fixture of fixtures) {
    const parsed = parseWorkspaceDocument({ schemaVersion: 4, revision: 0, updatedAt: 0, ...fixture.payload });
    assert.equal(parsed !== null, fixture.valid, `TS expected verdict: ${fixture.name}`);
    const normalized = JSON.parse(sql(`select coalesce(private.normalize_workspace_v4(${quote(fixture.payload)}), 'null'::jsonb)`));
    assert.equal(normalized !== null, fixture.valid, `SQL verdict: ${fixture.name}`);
    if (parsed) { const { schemaVersion, revision, updatedAt, ...payload } = parsed; assert.deepEqual(normalized, payload, `normalization: ${fixture.name}`); }
  }
  assert.equal(sql(`select private.normalize_workspace(${quote(flow)}) is null`), 't', 'historical v3 validator must not accept transfer slices');
  const v3Parsed = JSON.parse(sql(`select private.normalize_workspace(${quote(full)})`));
  assert.equal(v3Parsed.locations[0].shortName, '저축 통장', 'historical v3 location normalization is unchanged');
  assert.equal(v3Parsed.accountMap.applied.customPurposes[0].name, '여행 저축', 'historical v3 purpose normalization is unchanged');
  const initialId = randomUUID();
  const initial = rpc('initialize_workspace', empty, undefined, initialId);
  assert.equal(initial.status, 'saved'); assert.equal(initial.workspace.revision, 0);
  assert.equal(rpc('initialize_workspace', empty, undefined, initialId).committed_revision, 0);
  assert.equal(rpc('initialize_workspace', full).status, 'exists');
  assert.equal(sql(asUser('select count(*) from public.user_workspaces;', userB)), '0');
  assert.equal(sql(asUser('select count(*) from public.user_workspaces;')), '1');
  for (const command of ["select * from public.user_workspaces", "select public.initialize_workspace('{}', gen_random_uuid(), 4)"]) {
    assert.throws(() => sql(asUser(command, '', 'anon')), /permission denied/);
  }
  for (const command of ['delete from public.user_workspaces', 'update public.user_workspaces set revision=2', "insert into public.user_workspaces(user_id,payload) values (auth.uid(),'{}')", 'select * from private.workspace_mutations', "select private.normalize_workspace('{}')", "select private.normalize_workspace_v4('{}')", 'select private.request_uid()']) {
    assert.throws(() => sql(asUser(command)), /permission denied/);
  }
  assert.throws(() => sql(asUser("select public.initialize_workspace('{}', gen_random_uuid(), 4)", '')), /authentication required/);
  assert.equal(rpc('restore_workspace', full, 0).status, 'saved');
  const beforeInvalid = sql(asUser('select row_to_json(w) from public.user_workspaces w'));
  const invalid = structuredClone(full); invalid.accountMap.applied.links[0].locationId = 'absent';
  const invalidId = randomUUID();
  assert.equal(rpc('restore_workspace', invalid, 1, invalidId).status, 'invalid');
  assert.equal(sql(asUser('select row_to_json(w) from public.user_workspaces w')), beforeInvalid);
  assert.equal(sql(`select count(*) from private.workspace_mutations where mutation_id='${invalidId}'`), '0');
  assert.equal(rpc('save_main', { main: empty.main, simulation: empty.simulation }, 1).status, 'invalid');
  const main = structuredClone(full.main); main.applied.updatedAt = 101; main.applied.monthlySavingWon = 1;
  const mutation = randomUUID();
  const saved = rpc('save_main', { main }, 1, mutation);
  assert.equal(saved.status, 'saved'); assert.equal(saved.workspace.revision, 2);
  assert.deepEqual(saved.workspace.payload.simulation, full.simulation);
  assert.equal(rpc('save_simulation', { simulation: empty.simulation }, 1).status, 'conflict');
  assert.equal(rpc('save_simulation', { simulation: empty.simulation }, 2).workspace.revision, 3);
  const repeated = rpc('save_main', { main }, 1, mutation);
  assert.equal(repeated.status, 'saved'); assert.equal(repeated.committed_revision, 2); assert.equal(repeated.workspace.revision, 3);
  assert.equal(rpc('save_main', { main: empty.main }, 1, mutation).status, 'invalid');
  assert.equal(rpc('save_main', { main }, 3, mutation).status, 'invalid');
  const parallelSql = statement => exec('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', statement]).then(r => JSON.parse(r.stdout.trim()));
  const race = await Promise.all([parallelSql(call('save_portfolio', { portfolio: empty.portfolio }, 3)), parallelSql(call('save_portfolio', { portfolio: full.portfolio }, 3))]);
  assert.deepEqual(race.map(r => r.status).sort(), ['conflict', 'saved']);
  const retryId = randomUUID();
  const retry = await Promise.all([parallelSql(call('save_simulation', { simulation: full.simulation }, 4, retryId)), parallelSql(call('save_simulation', { simulation: full.simulation }, 4, retryId))]);
  assert.deepEqual(retry.map(r => r.committed_revision), [5, 5]);
  const initializeRace = await Promise.all([parallelSql(call('initialize_workspace', empty, undefined, randomUUID(), userC)), parallelSql(call('initialize_workspace', full, undefined, randomUUID(), userC))]);
  assert.deepEqual(initializeRace.map(r => r.status).sort(), ['exists', 'saved']);
  const account = rpc('save_account_map', { locations: [], accountMap: empty.accountMap }, 5);
  assert.equal(account.workspace.revision, 6); assert.deepEqual(account.workspace.payload.main, main);
  assert.deepEqual(account.workspace.payload.locations, []);
  const aSnapshot = sql(asUser('select row_to_json(w) from public.user_workspaces w'));
  assert.equal(rpc('initialize_workspace', empty, undefined, randomUUID(), userB).status, 'saved');
  assert.equal(rpc('restore_workspace', full, 0, randomUUID(), userB).workspace.user_id, userB);
  assert.equal(sql(asUser('select row_to_json(w) from public.user_workspaces w')), aSnapshot);
  assert.equal(sql(asUser(`select count(*) from public.user_workspaces where user_id='${userA}';`, userB)), '0');
  assert.equal(rpc('save_main', { main, user_id: userB }, 6).status, 'invalid');
  assert.equal(JSON.parse(sql(asUser(`select public.restore_workspace(jsonb_build_object('oversize',repeat('x',1048577)), gen_random_uuid(), 6, 4)`))).status, 'invalid');
  assert.equal(JSON.parse(sql(asUser(`select public.save_main(${quote({ main })}, null, 6, 4)`))).status, 'invalid');
  assert.equal(JSON.parse(sql(asUser(`select public.save_main(${quote({ main })}, gen_random_uuid(), null, 4)`))).status, 'invalid');

  // A receipt failure must roll back the preceding workspace UPDATE too.
  const failedReceipt = randomUUID();
  sql(`create function private.reject_test_receipt() returns trigger language plpgsql as $$ begin raise exception 'test receipt failure'; end $$;
    create trigger reject_test_receipt before insert on private.workspace_mutations for each row execute function private.reject_test_receipt();`);
  assert.throws(() => rpc('save_main', { main }, 6, failedReceipt), /test receipt failure/);
  assert.equal(sql(asUser('select row_to_json(w) from public.user_workspaces w')), aSnapshot);
  assert.equal(sql(`select count(*) from private.workspace_mutations where mutation_id='${failedReceipt}'`), '0');
  sql('drop trigger reject_test_receipt on private.workspace_mutations; drop function private.reject_test_receipt()');
  sql(`delete from private.workspace_mutations where user_id='${userA}' and mutation_id='${mutation}'`);
  assert.equal(rpc('save_main', { main }, 1, mutation).status, 'conflict');
  const transferred = rpc('restore_workspace', flow, 6);
  assert.equal(transferred.workspace.revision, 7);
  assert.deepEqual(transferred.workspace.payload.accountMap.applied.transfers, flow.accountMap.applied.transfers);
  const flowSave = rpc('save_account_map', { locations: transferred.workspace.payload.locations, accountMap: transferred.workspace.payload.accountMap }, 7);
  assert.equal(flowSave.workspace.revision, 8);
  assert.deepEqual(flowSave.workspace.payload.main, transferred.workspace.payload.main);
  assert.deepEqual(flowSave.workspace.payload.simulation, transferred.workspace.payload.simulation);
  assert.deepEqual(flowSave.workspace.payload.portfolio, transferred.workspace.payload.portfolio);
  assert.equal(sql(`select count(*) from private.workspace_schema_backups where user_id='${userA}'`), '0', 'new v4 accounts need no invented v3 backup');
  sql(`delete from auth.users where id='${legacyUser}'`);
  assert.equal(sql(`select count(*) from private.workspace_schema_backups where user_id='${legacyUser}'`), '0', 'before-image follows account deletion');
  sql(`update public.user_workspaces set revision=9007199254740991 where user_id='${userB}'`);
  assert.equal(rpc('restore_workspace', full, 9007199254740991, randomUUID(), userB).status, 'invalid');
  assert.equal(sql(asUser('select revision from public.user_workspaces', userB)), '9007199254740991');
  sql(`delete from auth.users where id='${userB}'`);
  assert.equal(sql(`select count(*) from public.user_workspaces where user_id='${userB}'`), '0');
  assert.equal(sql(`select count(*) from private.workspace_mutations where user_id='${userB}'`), '0');
  assert.equal(sql("select rolcanlogin or rolbypassrls from pg_roles where rolname='workspace_rpc_owner'"), 'f');
  assert.equal(sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('initialize_workspace','save_main','save_simulation','save_portfolio','save_account_map','restore_workspace') and p.prosecdef and p.proowner = 'workspace_rpc_owner'::regrole and p.proconfig @> array['search_path=\"\"']"), '6');
  const { verifyExpenseDatabase } = await import('./verify-expense-db.mjs');
  await verifyExpenseDatabase({sql, quote, asUser, vite, userA, userC});
  console.log(`PASS: ${fixtures.length} shared TS/SQL fixtures; v3 upgrade/before-images/rollback; required v4 protocol; PostgreSQL RLS, narrow RPCs, revisions, receipts, concurrent writes/retries/initialization.`);
} finally {
  await vite?.close();
  try { docker(['rm', '-f', container]); } catch { /* Container may not have started. */ }
}
