import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
export async function verifyLoungeDatabase({sql, quote, asUser, vite, userA, userC}) {
  const before = sql('select jsonb_agg(to_jsonb(w) order by user_id) from public.user_workspaces w');
  const migration = await readFile(new URL('../supabase/migrations/202609280002_portfolio_lounge.sql',import.meta.url),'utf8');
  sql(`set role migration_admin; ${migration}`);
  assert.equal(sql('select jsonb_agg(to_jsonb(w) order by user_id) from public.user_workspaces w'),before);
  const {parseSharedAllocation} = await vite.ssrLoadModule('/src/lounge/domain/publication.ts');
  const allocation={items:[{name:'SCHD',shareUnits:500000},{name:'금',shareUnits:300000}],cashShareUnits:200000};
  const call=(name,args='',user=userA)=>JSON.parse(sql(asUser(`select public.${name}(${args})`,user)) || 'null');
  const publish=(title='배당과 금',version='null',user=userA,value=allocation)=>call('publish_lounge_portfolio',`'${title}','투자자','',${quote(value)},${version}`,user);
  for (const value of [allocation,{...allocation,extra:100},{...allocation,cashShareUnits:-1},{...allocation,cashShareUnits:null},
    {...allocation,items:[{name:'SCHD',shareUnits:800000,amountWon:100}]},{...allocation,items:[{name:'SCHD',shareUnits:400000},{name:' schd ',shareUnits:400000}]},
    {items:[],cashShareUnits:1000000},{items:[{name:'X',shareUnits:0}],cashShareUnits:1000000},{items:[{name:'x'.repeat(41),shareUnits:1000000}],cashShareUnits:0},
    {items:[{name:'bad\nname',shareUnits:1000000}],cashShareUnits:0},null,[],{}, {items:'bad',cashShareUnits:1000000}]) {
    assert.equal(sql(`select private.valid_lounge_allocation(${quote(value)})`),parseSharedAllocation(value)?'t':'f');
  }
  const first=publish(); assert.equal(first.status,'saved'); const id=first.post.id;
  assert.equal(first.post.isMine,true); assert.ok(!JSON.stringify(first).includes(userA));
  assert.deepEqual(publish(),first,'lost-response retry does not duplicate or increment');
  const other=publish('다른 계정', 'null',userC); assert.equal(other.status,'saved');
  assert.equal(call('get_lounge_portfolio',`'${id}'`,userC).isMine,false);
  assert.equal(call('list_lounge_portfolios').length,2);
  assert.equal(call('list_lounge_portfolios','true').length,1);
  const page=call('list_lounge_portfolios','false,null,null,1'); assert.equal(page.length,1);
  const next=call('list_lounge_portfolios',`false,'${page[0].updatedAt}','${page[0].id}',1`); assert.equal(next.length,1); assert.notEqual(page[0].id,next[0].id);
  assert.equal(publish('새 제목',99).status,'conflict');
  assert.equal(publish(' ',1).status,'invalid');
  assert.equal(publish('추가 금액',1,userA,{...allocation,money:500}).status,'invalid');
  const updated=publish('새 제목',1); assert.equal(updated.post.version,2);
  const publicationBefore = sql('select jsonb_agg(to_jsonb(p) order by id) from public.portfolio_publications p');
  const assetMigration = await readFile(new URL('../supabase/migrations/202609280003_lounge_asset_band.sql',import.meta.url),'utf8');
  sql(`set role migration_admin; ${assetMigration}`);
  assert.equal(sql("select jsonb_agg(to_jsonb(p)-'asset_band' order by id) from public.portfolio_publications p"),publicationBefore);
  assert.equal(call('get_lounge_portfolio_v2',`'${id}'`).assetBand,null);
  assert.ok(!('assetBand' in call('get_lounge_portfolio',`'${id}'`)),'v1 response remains compatible');

  assert.equal(call('delete_lounge_portfolio',`'${id}',1`).status,'conflict');
  // Another account can never remove the row, regardless of knowledge of ID/version.
  call('delete_lounge_portfolio',`'${id}',2`,userC); assert.ok(call('get_lounge_portfolio',`'${id}'`));
  for (const role of ['anon','authenticated','service_role']) {
    for (const stmt of ['select * from public.portfolio_publications','delete from public.portfolio_publications',
      "update public.portfolio_publications set title='stolen'","insert into public.portfolio_publications(owner_id,title,alias,note,allocation) values(gen_random_uuid(),'x','x','','{}')"]) {
      assert.throws(()=>sql(asUser(stmt,userA,role)),/permission denied/);
    }
    assert.equal(sql(`select has_function_privilege('${role}','private.valid_lounge_allocation(jsonb)','execute')`),'f');
  }
  assert.throws(()=>sql(asUser('select public.list_lounge_portfolios()',null,'anon')),/permission denied/);
  assert.throws(()=>sql(asUser('select public.list_lounge_portfolios()',null)),/authentication required/);
  assert.equal(sql("select rolcanlogin or rolinherit or rolbypassrls from pg_roles where rolname='lounge_rpc_owner'"),'f');
  assert.equal(sql("select count(*) from pg_proc where proname like '%lounge_portfolio%' and prosecdef and proconfig @> array['search_path=\"\"'] and proowner='lounge_rpc_owner'::regrole"),'7');
  assert.equal(sql("select has_table_privilege('lounge_rpc_owner','public.user_workspaces','SELECT')"),'f');
  call('delete_lounge_portfolio',`'${id}',2`); assert.equal(call('get_lounge_portfolio',`'${id}'`),null);
  const publishBand=(band,version='null',title='자산 구간')=>call('publish_lounge_portfolio_v2',`'${title}','투자자','',${quote(allocation)},${version},${band===null?'null':"'"+band+"'"}`);
  assert.equal(publishBand('20123456').status,'invalid');
  const bandPost=publishBand('20m').post; assert.equal(bandPost.assetBand,'20m');
  assert.equal(publishBand('20m').post.version,1,'same-content lost response retry');
  assert.equal(call('get_lounge_portfolio_v2',`'${bandPost.id}'`,userC).assetBand,'20m');
  assert.ok(call('list_lounge_portfolios_v2').some(p=>p.assetBand==='20m'));
  assert.ok(!('assetBand' in call('get_lounge_portfolio',`'${bandPost.id}'`)));
  assert.equal(publish('구버전 갱신',1).status,'saved');
  assert.equal(call('get_lounge_portfolio_v2',`'${bandPost.id}'`).assetBand,'20m','v1 update preserves consented band');
  assert.equal(publishBand(null,1).status,'conflict');
  const hidden=publishBand(null,2); assert.equal(hidden.post.assetBand,null); assert.equal(hidden.post.version,3);
  assert.equal(publishBand(null,2).post.version,3,'removal retry is idempotent');
  assert.equal(publishBand('under_10m',3).post.assetBand,'under_10m');
  for(const band of ['10m','30m','90m','100m','900m','1b_plus']) {
    const current=call('get_lounge_portfolio_v2',`'${bandPost.id}'`);
    assert.equal(publishBand(band,current.version).post.assetBand,band);
  }
  assert.throws(()=>sql(asUser('select public.list_lounge_portfolios_v2()',null,'anon')),/permission denied/);
  assert.throws(()=>sql(asUser('select public.list_lounge_portfolios_v2()',null)),/authentication required/);
  assert.throws(()=>sql(asUser(`select public.get_lounge_portfolio_v2('${bandPost.id}')`,null,'anon')),/permission denied/);
  const current=call('get_lounge_portfolio_v2',`'${bandPost.id}'`);
  call('delete_lounge_portfolio',`'${bandPost.id}',${current.version}`);
  // Separate disposable auth row proves cascade without changing existing workspace users.
  const temp='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'; sql(`insert into auth.users values('${temp}')`);
  publish('cascade','null',temp); sql(`delete from auth.users where id='${temp}'`);
  assert.equal(sql(`select count(*) from public.portfolio_publications where owner_id='${temp}'`),'0');
  assert.equal(sql('select jsonb_agg(to_jsonb(w) order by user_id) from public.user_workspaces w'),before,'all lounge actions preserve every workspace');
  // Bound the entire new table, while still permitting the existing owner to update.
  sql(`insert into auth.users select gen_random_uuid() from generate_series(1,4999);
    insert into public.portfolio_publications(owner_id,title,alias,note,allocation)
    select id,'cap','cap','','{"items":[],"cashShareUnits":1000000}' from auth.users where id not in('${userA}','${userC}')`);
  assert.equal(publish().status,'full');
  assert.equal(publishBand('20m').status,'full');
  assert.equal(publish('상한에서도 갱신',1,userC).status,'saved');
  console.log('PASS: Lounge strict TS/SQL payloads, two-account read/ownership, anon and direct access denial, pagination, retry/CAS, deletion/cascade, original workspace preservation, global 5000-row cap.');
}
