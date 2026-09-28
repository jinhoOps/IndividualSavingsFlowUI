import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

export async function verifyLoungeDeveloper({sql,asUser,userA,userC,vite,parallelSql}) {
  const call=(name,args='',user=userA)=>JSON.parse(sql(asUser(`select to_json(public.${name}(${args}))`,user)));
  const snapshot=()=>sql(`select jsonb_build_array(
    (select md5(string_agg(row_to_json(w)::text,'' order by user_id)) from public.user_workspaces w),
    (select md5(string_agg(row_to_json(p)::text,'' order by id)) from public.portfolio_publications p),
    (select md5(string_agg(row_to_json(c)::text,'' order by id)) from public.lounge_comments c),
    (select md5(string_agg(row_to_json(n)::text,'' order by id)) from public.lounge_notifications n))`);
  const before=snapshot();
  sql(`set role migration_admin; ${await readFile(new URL('../supabase/migrations/202609280011_lounge_developer_notifications.sql',import.meta.url),'utf8')}`);
  assert.equal(snapshot(),before);
  assert.equal(call('get_lounge_developer_access'),false);
  const provision=await readFile(new URL('../supabase/operations/grant-lounge-developer.sql',import.meta.url),'utf8');
  sql('alter table auth.users add column if not exists email text, add column if not exists email_confirmed_at timestamptz');
  sql('grant select(id,email,email_confirmed_at) on auth.users to migration_admin');
  const provisionAsOperator=()=>sql(`set role migration_admin; ${provision}`);
  assert.throws(provisionAsOperator,/query returned no rows/,'provisioning never creates an account');
  sql(`update auth.users set email='okho04@gmail.com',email_confirmed_at=clock_timestamp() where id='${userA}'`);
  provisionAsOperator();
  assert.equal(call('get_lounge_developer_access'),true);assert.equal(call('get_lounge_developer_access','',userC),false);
  assert.equal(call('create_lounge_test_notification',`'${randomUUID()}'`,userC).status,'forbidden');
  for(const role of ['anon','authenticated','service_role']){
    assert.equal(sql(`select has_table_privilege('${role}','private.lounge_developers','select,insert,update,delete')`),'f');
    assert.equal(sql(`select has_function_privilege('${role}','private.lounge_notification_feed_v2()','execute')`),'f');
  }
  assert.throws(()=>call('get_lounge_developer_access','',null),/authentication required/);
  assert.throws(()=>sql(asUser('select public.create_lounge_test_notification(gen_random_uuid())',null,'anon')),/permission denied/);
  const legacy=call('list_lounge_notifications','false,null');
  const id=randomUUID(),saved=call('create_lounge_test_notification',`'${id}'`);assert.equal(saved.status,'saved');
  provisionAsOperator();assert.equal(sql(`select test_id from private.lounge_developers where user_id='${userA}'`),id,'provisioning retries preserve the test slot');
  const {parseNotificationPage,parseUnreadState}=await vite.ssrLoadModule('/src/lounge/domain/notifications.ts');
  assert.ok(parseUnreadState(saved.state));
  const page=call('list_lounge_notifications_v2','false,null');assert.ok(parseNotificationPage(page));
  const event=page.items.find(item=>item.id===id);assert.equal(event.kind,'test');assert.equal(event.postId,null);assert.equal(event.commentId,null);
  assert.equal(page.items.filter(item=>item.kind==='test').length,1);assert.equal(event.read,false);
  assert.equal(call('create_lounge_test_notification',`'${id}'`).status,'saved','response-lost retries reuse the event');
  assert.equal(call('create_lounge_test_notification',`'${randomUUID()}'`).status,'rate-limited');
  const old=call('list_lounge_notifications','false,null');
  assert.deepEqual(old.items,legacy.items);assert.equal(old.unreadCount,legacy.unreadCount);assert.deepEqual(old.readIds,legacy.readIds);
  assert.ok(!call('list_lounge_notifications_v2','false,null',userC).items.some(item=>item.id===id));
  call('read_lounge_notifications_v2',`'["${id}"]',null`,userC);
  assert.equal(call('list_lounge_notifications_v2','false,null').items.find(item=>item.id===id).read,false);
  call('read_lounge_notifications_v2',`'["${id}"]',null`);
  assert.equal(call('list_lounge_notifications_v2','false,null').items.find(item=>item.id===id).read,true);
  const age=()=>sql(`update private.lounge_developers set test_created_at=clock_timestamp()-interval '11 seconds' where user_id='${userA}'`);
  age();const next=randomUUID();
  const concurrent=await Promise.all([1,2].map(()=>parallelSql(asUser(`select public.create_lounge_test_notification('${next}')`))));
  assert.ok(concurrent.every(result=>result.status==='saved'));
  call('read_lounge_notifications_v2',`'["${id}"]','${page.readCutoff}'`);
  assert.equal(call('list_lounge_notifications_v2','true,null').items.find(item=>item.id===next).read,false,'old snapshots leave new tests unread');
  assert.equal(sql(`select count(*) from private.lounge_developers where user_id='${userA}'`),'1');
  sql(`update private.lounge_developers set test_created_at=clock_timestamp()-interval '31 days' where user_id='${userA}'`);
  assert.ok(!call('list_lounge_notifications_v2','false,null').items.some(item=>item.kind==='test'));
  // A full real inbox plus the private test still presents exactly 100 events.
  const actor=randomUUID(),post=randomUUID(),testId=randomUUID();
  const bounded=JSON.parse(sql(`begin;
    insert into auth.users(id) values('${actor}');
    insert into public.lounge_profiles(user_id,nickname) values('${actor}','개발한도${actor.slice(0,8)}');
    insert into public.portfolio_publications(id,owner_id,title,alias,note,allocation)
      values('${post}','${actor}','알림 한도','개발한도${actor.slice(0,8)}','','{"items":[],"cashShareUnits":1000000}');
    delete from public.lounge_notifications where recipient_id='${userA}';
    with comments as(insert into public.lounge_comments(id,post_id,user_id,body)
      select gen_random_uuid(),'${post}','${actor}','테스트 데이터' from generate_series(1,100) returning id)
    insert into public.lounge_notifications(recipient_id,actor_id,post_id,comment_id,kind,created_at)
      select '${userA}','${actor}','${post}',id,'mention',clock_timestamp()-interval '1 minute' from comments;
    update private.lounge_developers set test_id='${testId}',test_created_at=clock_timestamp(),test_read_at=null where user_id='${userA}';
    ${asUser(`select public.list_lounge_notifications_v2(false,null)`,userA)}; rollback;`));
  assert.ok(parseNotificationPage(bounded));assert.equal(bounded.unreadCount,100);assert.equal(bounded.readIds.length,100);
  assert.equal(bounded.items.length,20);assert.equal(bounded.items[0].id,testId);assert.ok(bounded.nextCursor);
  assert.equal(snapshot(),before,'test notifications never modify real comments, notifications or financial data');
  sql(`delete from private.lounge_developers where user_id='${userA}'`);
  assert.equal(call('get_lounge_developer_access'),false);assert.equal(call('create_lounge_test_notification',`'${randomUUID()}'`).status,'forbidden');
  console.log('PASS: developer allowlist, private test event, retry/concurrency/rate limits, read isolation/snapshot/expiry, unchanged v1 notifications and workspace.');
}
