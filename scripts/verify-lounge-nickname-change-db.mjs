import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

export async function verifyNicknameChanges({sql,quote,asUser,userA,userC,parallelSql}) {
  const literal=value=>value===null?'null':`'${value.replaceAll("'","''")}'`;
  const call=(name,args='',user=userA)=>JSON.parse(sql(asUser(`select public.${name}(${args})`,user))||'null');
  const change=(nickname,version,user=userA)=>call('change_lounge_nickname',`${literal(nickname)},${version??'null'}`,user);
  const settings=(user=userA)=>call('get_lounge_profile_v2','',user);
  sql("delete from auth.users where id in(select user_id from public.lounge_profiles where nickname like 'cap.%')");
  const before=table=>sql(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from public.${table} t`);
  const workspaceBefore=before('user_workspaces'),postsBefore=before('portfolio_publications'),profilesBefore=before('lounge_profiles');
  const migration=await readFile(new URL('../supabase/migrations/202609280005_lounge_nickname_change.sql',import.meta.url),'utf8');
  sql(`set role migration_admin; ${migration}`);
  assert.equal(before('portfolio_publications'),postsBefore);
  assert.equal(sql("select coalesce(jsonb_agg(to_jsonb(t)-'nickname_changed_at'-'nickname_version' order by (to_jsonb(t)-'nickname_changed_at'-'nickname_version')::text),'[]'::jsonb) from public.lounge_profiles t"),profilesBefore);
  assert.equal(settings().version,1);assert.equal(settings().nextChangeAt,null);
  const original=call('list_lounge_portfolios_v2','true')[0];
  const invalid=[null,"ab';drop table x--",'a OR 1=1','<svg/onload=alert(1)>','<script>alert(1)</script>','a\nb','a\rb','a\tb','a\u200bb','a\u202eb','a'.repeat(50000),'-.@','a_b','😀abc'];
  for(const value of invalid) assert.equal(change(value,1).status,'invalid',String(value).slice(0,40));
  for(const version of [null,0,-1]) assert.equal(change('정상입력',version).status,'invalid');
  assert.equal(settings().version,1);assert.equal(before('portfolio_publications'),postsBefore);
  // New registrations remain compatible and cannot be used to rename an existing user.
  assert.equal(call('register_lounge_nickname',literal('a'.repeat(50000))).status,'invalid');
  assert.equal(call('register_lounge_nickname',"'우회등록'").status,'exists');
  const first=change('새로운-Kim.1@',1);assert.equal(first.status,'saved');
  assert.equal(first.profile.version,2);assert.equal(first.profile.nickname,'새로운-Kim.1@');
  const until=Date.parse(first.profile.nextChangeAt),now=Date.parse(first.profile.serverNow);
  assert.ok(until-now>48*3600000-2000 && until-now<=48*3600000);
  const post=call('get_lounge_portfolio_v2',literal(original.id));
  assert.equal(post.alias,first.profile.nickname);assert.equal(post.version,original.version+1);
  for(const key of ['title','note','allocation','assetBand','updatedAt']) assert.deepEqual(post[key],original[key]);
  assert.deepEqual(call('get_lounge_profile'),{nickname:first.profile.nickname},'v1 DTO still works');
  const retry=change(first.profile.nickname,1);assert.equal(retry.status,'unchanged');assert.equal(retry.profile.version,2);assert.equal(retry.profile.nextChangeAt,first.profile.nextChangeAt);
  assert.equal(call('get_lounge_portfolio_v2',literal(original.id)).version,post.version);
  const blocked=change('재변경',2);assert.equal(blocked.status,'cooldown');assert.equal(blocked.profile.nextChangeAt,first.profile.nextChangeAt);
  assert.equal(change('오래된화면',1).status,'conflict');assert.equal(change('새로운-kim.1@',2).status,'cooldown');
  // Even the RPC role's direct nickname update cannot skip the trigger's clock check.
  assert.throws(()=>sql(asUser("update public.lounge_profiles set nickname='우회변경' where user_id='"+userA+"'",userA,'lounge_rpc_owner')),/nickname cooldown/);
  for(const column of ['nickname_changed_at','nickname_version','user_id','created_at']) {
    assert.equal(sql(`select has_column_privilege('lounge_rpc_owner','public.lounge_profiles','${column}','UPDATE')`),'f');
  }
  for(const role of ['anon','authenticated','service_role']) {
    assert.throws(()=>sql(asUser("update public.lounge_profiles set nickname='다른이름'",userA,role)),/permission denied/);
    assert.throws(()=>sql(asUser('select * from public.lounge_profiles',userA,role)),/permission denied/);
  }
  for(const [name,args] of [['get_lounge_profile_v2',''],['change_lounge_nickname',"'공격이름',1"]]) {
    assert.throws(()=>sql(asUser(`select public.${name}(${args})`,null,'anon')),/permission denied/);
    assert.throws(()=>sql(asUser(`select public.${name}(${args})`,null)),/authentication required/);
  }
  assert.throws(()=>call('change_lounge_nickname',`p_nickname=>'침입이름',p_expected_version=>2,p_user_id=>'${userC}'`),/does not exist/);
  assert.throws(()=>call('change_lounge_nickname',"p_nickname=>'시간위조',p_expected_version=>2,p_changed_at=>'2000-01-01'"),/does not exist/);
  const otherBefore=settings(userC);
  sql(asUser(`update public.lounge_profiles set nickname='다른계정' where user_id='${userC}'`,userA,'lounge_rpc_owner'));
  assert.equal(settings(userC).nickname,otherBefore.nickname);
  // Simulate passage of time only in this disposable DB fixture, never through a public RPC.
  const age=(user,interval)=>sql(`begin; alter table public.lounge_profiles disable trigger lounge_profile_change_guard;
    update public.lounge_profiles set nickname_changed_at=clock_timestamp()-interval '${interval}' where user_id='${user}';
    alter table public.lounge_profiles enable trigger lounge_profile_change_guard; commit;`);
  age(userA,'47 hours 59 minutes');assert.equal(change('너무일찍',2).status,'cooldown');
  age(userA,'48 hours');assert.equal(change(otherBefore.nickname.toUpperCase(),2).status,'taken');assert.equal(settings().version,2);
  const second=change('새로운-kim.1@',2);assert.equal(second.status,'saved');assert.equal(second.profile.version,3,'case-only change also starts a cooldown');
  // Race: two changes for one account have one winner; different accounts cannot claim equivalent names.
  age(userA,'49 hours');
  const same=await Promise.all(['후보하나','후보둘'].map(name=>parallelSql(asUser(`select public.change_lounge_nickname('${name}',3)`,userA))));
  assert.deepEqual(same.map(x=>x.status).sort(),['conflict','saved']);assert.equal(settings().version,4);
  age(userA,'49 hours');
  const cross=await Promise.all([parallelSql(asUser("select public.change_lounge_nickname('Race.Name',4)",userA)),parallelSql(asUser("select public.change_lounge_nickname('race.name',1)",userC))]);
  assert.deepEqual(cross.map(x=>x.status).sort(),['saved','taken']);
  // Stored text that resembles SQL/HTML remains literal data in the existing posting path.
  const current=call('get_lounge_portfolio_v2',literal(original.id));
  const note="<img src=x onerror=alert(1)> '; DROP TABLE public.lounge_profiles; --";
  const textPost=call('publish_lounge_portfolio_v3',`${literal(current.title)},${literal(note)},${quote(current.allocation)},${current.version},${literal(current.assetBand??null)}`);
  assert.equal(textPost.status,'saved');assert.equal(textPost.post.note,note);assert.ok(Number(sql('select count(*) from public.lounge_profiles'))>=3);
  assert.equal(before('user_workspaces'),workspaceBefore);
  console.log('PASS: nickname change migration retention, exact 48h server rule, no-op/retry, CAS/races, profile/publication atomicity, SQLi/XSS literal inputs, payload bounds, IDOR/RLS/metadata denial and v1 compatibility.');
}
