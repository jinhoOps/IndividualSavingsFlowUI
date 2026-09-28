import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
export async function verifyLoungeDiscovery({sql,asUser,userA,vite}) {
  const json=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
  const {parseFeedPage,feedQueryKey,DEFAULT_FEED_QUERY}=await vite.ssrLoadModule('/src/lounge/domain/discovery.ts');
  const before=sql("select md5(string_agg(row_to_json(p)::text,'' order by id)) from public.portfolio_publications p");
  sql(`set role migration_admin; ${await readFile(new URL('../supabase/migrations/202609280008_lounge_discovery.sql',import.meta.url),'utf8')}`);
  assert.equal(sql("select md5(string_agg(row_to_json(p)::text,'' order by id)) from public.portfolio_publications p"),before);
  const query={...DEFAULT_FEED_QUERY,q:'발견'};
  const read=(q=query,cursor=null,user=userA)=>JSON.parse(sql(asUser(`select public.search_lounge_portfolios(${json(q)},${cursor===null?'null':json(cursor)})`,user)));
  sql(`create table public.discovery_fixture as select n,gen_random_uuid() owner_id,('eeeeeeee-eeee-4eee-8eee-'||lpad(n::text,12,'0'))::uuid post_id from generate_series(1,25) n;
    insert into auth.users select owner_id from discovery_fixture;
    insert into public.lounge_profiles(user_id,nickname) select owner_id,'검색.'||n from discovery_fixture;
    insert into public.portfolio_publications(id,owner_id,title,alias,note,allocation,asset_band,updated_at)
      select post_id,owner_id,'발견 '||n,'검색.'||n,case when n=2 then '기호 %_\\ 문자' else '금 비중을 살펴요' end,
      jsonb_build_object('items',jsonb_build_array(jsonb_build_object('name',case when n=1 then 'VOO' else '금' end,'shareUnits',case when n%2=0 then 900000 else 1000000 end)),
      'cashShareUnits',case when n%2=0 then 100000 else 0 end),case when n%3=0 then null when n%3=1 then '20m' else '100m' end,statement_timestamp()-interval '1 hour' from discovery_fixture;`);
  const first=read();assert.ok(parseFeedPage(first));assert.equal(first.items.length,12);assert.equal(first.nextCursor.queryKey,feedQueryKey(query));
  const second=read(query,first.nextCursor),third=read(query,second.nextCursor);
  assert.equal(second.items.length,12);assert.equal(third.items.length,1);assert.equal(third.nextCursor,null);
  assert.equal(new Set([...first.items,...second.items,...third.items].map(p=>p.id)).size,25);
  const search=q=>read({...query,q}).items;
  assert.equal(search('VOO')[0].id,'eeeeeeee-eeee-4eee-8eee-000000000001','instrument on later page is searched on the server');
  assert.ok(search('금').length);assert.equal(search('검색.25')[0].alias,'검색.25');
  assert.equal(search('%_\\')[0].id,'eeeeeeee-eeee-4eee-8eee-000000000002');
  assert.equal(search("'; drop table public.portfolio_publications; --").length,0);
  assert.equal(read({...query,q:'금'}).nextCursor.queryKey,feedQueryKey({...query,q:'금'}));
  for(const item of read({...query,hasCash:true,assetBands:['hidden','20m']}).items){assert.ok(item.allocation.cashShareUnits>0);assert.ok(item.assetBand===null || item.assetBand==='20m');}
  const owner=sql("select owner_id from discovery_fixture where n=25");
  assert.equal(read({...query,scope:'mine'},null,owner).items[0].id,'eeeeeeee-eeee-4eee-8eee-000000000025');
  sql("update public.portfolio_publications set updated_at=clock_timestamp()-interval '15 days' where id='eeeeeeee-eeee-4eee-8eee-000000000001'");
  assert.equal(read({...query,q:'VOO',period:'7d'}).items.length,0);assert.equal(read({...query,q:'VOO',period:'30d'}).items.length,1);
  for(const bad of [{...query,scope:null},{...query,sort:null},{...query,period:null},[],{...query,sort:'return-rate'},{...query,secret:true},{...query,assetBands:['secret']},{...query,q:'x'.repeat(81)},{...query,q:'a\nb'},null])assert.throws(()=>read(bad),/invalid query/);
  assert.throws(()=>read({...query,hasCash:true},first.nextCursor),/invalid cursor/);
  for(const cursor of [{...first.nextCursor,asOf:'infinity'},{...first.nextCursor,asOf:'2999-01-01T00:00:00Z'},{...first.nextCursor,last:{...first.nextCursor.last,id:'bad'}},{...first.nextCursor,extra:true}])assert.throws(()=>read(query,cursor),/invalid cursor/);
  assert.equal(read(query,{...first.nextCursor,asOf:'2020-01-01T00:00:00Z',last:{...first.nextCursor.last,updatedAt:'2019-01-01T00:00:00Z'}}).status,'cursor-expired');
  assert.equal(read({...query,sort:'comments'}).status,'ranking-unavailable');
  assert.throws(()=>read(query,null,null),/authentication/);
  assert.equal(sql("select has_function_privilege('anon','public.search_lounge_portfolios(jsonb,jsonb)','execute')"),'f');
  assert.equal(sql("select has_function_privilege('service_role','public.search_lounge_portfolios(jsonb,jsonb)','execute')"),'f');
  // An edited seen item and newly matching item do not reappear inside the fixed asOf traversal.
  const seen=first.items[0].id;
  sql(`update public.portfolio_publications set title='발견 변경',updated_at=clock_timestamp() where id='${seen}'`);
  sql(`insert into discovery_fixture values(26,gen_random_uuid(),'eeeeeeee-eeee-4eee-8eee-000000000026');
    insert into auth.users select owner_id from discovery_fixture where n=26;
    insert into public.lounge_profiles(user_id,nickname) select owner_id,'검색.26' from discovery_fixture where n=26;
    insert into public.portfolio_publications(id,owner_id,title,alias,note,allocation) select post_id,owner_id,'발견 신규','검색.26','',
      '{"items":[],"cashShareUnits":1000000}'::jsonb from discovery_fixture where n=26;`);
  const next=read(query,first.nextCursor);assert.ok(!next.items.some(p=>p.id===seen || p.id==='eeeeeeee-eeee-4eee-8eee-000000000026'));assert.ok(read().items.some(p=>p.id==='eeeeeeee-eeee-4eee-8eee-000000000026'));assert.ok(read().items.some(p=>p.id===seen));
  assert.ok(parseFeedPage(next));
  assert.equal(JSON.parse(sql(asUser('select public.list_lounge_portfolios_v2(false,null,null,12)'))).length,12,'legacy list remains usable');
  sql('delete from auth.users where id in(select owner_id from discovery_fixture);drop table public.discovery_fixture');
  console.log('PASS: discovery literal search, NFC, filters, deterministic 12/12/1 cursor, expiry, RLS and v2 compatibility.');
}
