import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

export async function verifyLoungeProfiles({sql, quote, asUser, vite, userA, userC, parallelSql}) {
  const literal=value=>value===null?'null':`'${value.replaceAll("'","''")}'`;
  const call=(name,args='',user=userA)=>JSON.parse(sql(asUser(`select public.${name}(${args})`,user))||'null');
  const register=(nickname,user=userA)=>call('register_lounge_nickname',literal(nickname),user);
  const allocation={items:[],cashShareUnits:1000000};
  // Remove only the disposable capacity fixtures from the preceding Lounge test.
  sql("delete from auth.users where id in(select owner_id from public.portfolio_publications where title='cap')");
  const legacy=call('publish_lounge_portfolio_v2',`'기존 공유','old name !','',${quote(allocation)}`).post;
  const workspaceBefore=sql('select jsonb_agg(to_jsonb(w) order by user_id) from public.user_workspaces w');
  const postsBefore=sql('select jsonb_agg(to_jsonb(p) order by id) from public.portfolio_publications p');
  const migration=await readFile(new URL('../supabase/migrations/202609280004_lounge_nickname.sql',import.meta.url),'utf8');
  sql(`set role migration_admin; ${migration}`);
  assert.equal(sql('select jsonb_agg(to_jsonb(p) order by id) from public.portfolio_publications p'),postsBefore,'migration never confirms legacy aliases');
  assert.equal(call('get_lounge_profile'),null);
  assert.equal(call('publish_lounge_portfolio_v3',`'새 공유','',${quote(allocation)}`).status,'profile-required');
  assert.throws(()=>call('publish_lounge_portfolio',`'닉네임 없이 변경','fake','',${quote(allocation)},1`),/nickname required/);
  assert.throws(()=>call('publish_lounge_portfolio_v2',`'닉네임 없이 변경','fake','',${quote(allocation)},1`),/nickname required/);
  const {parseNickname}=await vite.ssrLoadModule('/src/lounge/domain/profile.ts');
  const candidates=['가나다','ㄱㄴ','ㅏㅣ','a1','@투자자','Ab-1.@','z'.repeat(20),'가나다'.normalize('NFD'),
    null,'','a','z'.repeat(21),'가 나',' 가나다','가나다 ','abc\n','abc\r','a\tb','a_b','@.-','투자😊','a/b','a\\b','a+b','A＠B','a\u200bb'];
  for(const value of candidates) {
    assert.equal(sql(`select private.valid_lounge_nickname(normalize(${literal(value)},NFC))`),parseNickname(value)?'t':'f',String(value));
    if(!parseNickname(value)) assert.equal(register(value).status,'invalid');
  }
  const fixed='Kim-지호.1@';
  assert.deepEqual(register(fixed),{status:'saved',profile:{nickname:fixed}});
  const own=call('get_lounge_portfolio_v2',`'${legacy.id}'`);
  assert.equal(own.alias,fixed);assert.equal(own.version,2);assert.equal(own.updatedAt,legacy.updatedAt);assert.deepEqual(own.allocation,allocation);
  assert.deepEqual(register('다른이름'),{status:'exists',profile:{nickname:fixed}});
  assert.deepEqual(register(fixed),{status:'exists',profile:{nickname:fixed}});
  assert.equal(register(fixed.toLowerCase(),userC).status,'taken');assert.equal(call('get_lounge_profile','',userC),null);
  assert.equal(register('차곡차곡'.normalize('NFD'),userC).profile.nickname,'차곡차곡');
  assert.deepEqual(call('get_lounge_profile'),{nickname:fixed});
  assert.ok(!JSON.stringify(call('get_lounge_profile')).includes(userA));
  assert.throws(()=>sql(`update public.lounge_profiles set nickname='바꾼이름' where user_id='${userA}'`),/immutable/);
  const published=call('publish_lounge_portfolio_v3',`'새 공유','',${quote(allocation)},2,'20m'`);
  assert.equal(published.status,'saved');assert.equal(published.post.alias,fixed);
  assert.equal(call('publish_lounge_portfolio_v3',`'새 공유','',${quote(allocation)},2,'20m'`).post.version,published.post.version,'new RPC retry');
  for(const name of ['publish_lounge_portfolio','publish_lounge_portfolio_v2']) {
    const current=call('get_lounge_portfolio',`'${legacy.id}'`);
    assert.equal(call(name,`'구버전 갱신','impersonation','',${quote(allocation)},${current.version}`).post.alias,fixed,'legacy writes cannot select an alias');
  }
  for(const role of ['anon','authenticated','service_role']) {
    for(const statement of ['select * from public.lounge_profiles',"update public.lounge_profiles set nickname='changed'",'delete from public.lounge_profiles',`insert into public.lounge_profiles values('${userA}','new',now())`]) {
      assert.throws(()=>sql(asUser(statement,userA,role)),/permission denied/);
    }
  }
  for(const [name,args] of [['get_lounge_profile',''],['register_lounge_nickname',"'abc'"],['publish_lounge_portfolio_v3',`'post','',${quote(allocation)}`]]) {
    assert.throws(()=>sql(asUser(`select public.${name}(${args})`,null,'anon')),/permission denied/);
    assert.throws(()=>sql(asUser(`select public.${name}(${args})`,null)),/authentication required/);
  }
  assert.equal(sql("select has_table_privilege('lounge_rpc_owner','public.lounge_profiles','UPDATE,DELETE')"),'f');
  assert.equal(sql("select relforcerowsecurity from pg_class where oid='public.lounge_profiles'::regclass"),'t');
  const userD='dddddddd-dddd-dddd-dddd-dddddddddddd',userE='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',userF='ffffffff-ffff-ffff-ffff-ffffffffffff';
  sql(`insert into auth.users values('${userD}'),('${userE}'),('${userF}')`);
  const race=await Promise.all([parallelSql(asUser("select public.register_lounge_nickname('Race-1')",userD)),parallelSql(asUser("select public.register_lounge_nickname('race-1')",userE))]);
  assert.deepEqual(race.map(r=>r.status).sort(),['saved','taken']);
  const sameAccount=await Promise.all([parallelSql(asUser("select public.register_lounge_nickname('한번만-1')",userF)),parallelSql(asUser("select public.register_lounge_nickname('한번만-2')",userF))]);
  assert.deepEqual(sameAccount.map(r=>r.status).sort(),['exists','saved']);assert.equal(sameAccount[0].profile.nickname,sameAccount[1].profile.nickname);
  call('publish_lounge_portfolio_v3',`'삭제용','',${quote(allocation)}`,userF);
  sql(`delete from auth.users where id='${userF}'`);
  assert.equal(sql(`select count(*) from public.lounge_profiles where user_id='${userF}'`),'0');
  assert.equal(sql(`select count(*) from public.portfolio_publications where owner_id='${userF}'`),'0');
  assert.equal(sql('select jsonb_agg(to_jsonb(w) order by user_id) from public.user_workspaces w'),workspaceBefore);
  // Global capacity is bounded, while a saved profile can still be retrieved/retried.
  const remaining=5000-Number(sql('select count(*) from public.lounge_profiles'));
  sql(`insert into auth.users select gen_random_uuid() from generate_series(1,${remaining});
    insert into public.lounge_profiles(user_id,nickname)
    select id,'cap.'||row_number() over(order by id) from auth.users where id not in('${userA}','${userC}','${userD}','${userE}')`);
  const unregistered=race[0].status==='taken'?userD:userE;
  assert.equal(register('완전히새이름',unregistered).status,'full');assert.equal(register(fixed).status,'exists');
  console.log('PASS: Lounge nickname TS/SQL parity, NFC/case uniqueness, explicit legacy rename, immutable profile, alias spoof denial, RLS, simultaneous registration, retry/cascade, workspace retention and 5000-profile cap.');
}
