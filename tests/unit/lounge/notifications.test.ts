import {expect,it} from 'vitest';
import {parseNotificationPage,parseUnreadState} from '../../../src/lounge/domain/notifications';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const time='2026-09-28T01:00:00Z';
const item={id,postId:id,commentId:other,kind:'mention',actor:{publicId:other,nickname:'투자자'},preview:'안녕하세요',createdAt:time,read:false};
const page={items:[item],nextCursor:null,unreadCount:1,readCutoff:time,readIds:[id]};
it('알림의 읽음 snapshot과 개인정보 없는 응답을 검증한다',()=>{
  expect(parseNotificationPage(page)).toEqual(page);
  expect(parseNotificationPage({...page,items:[{...item,userId:other}]})).toBeNull();
  expect(parseNotificationPage({...page,readIds:[id,id]})).toBeNull();
  expect(parseNotificationPage({...page,items:[{...item,kind:'like'}]})).toBeNull();
  expect(parseNotificationPage({...page,items:[{...item,preview:'x'.repeat(81)}]})).toBeNull();
  expect(parseNotificationPage({...page,unreadCount:101})).toBeNull();
});
it('빈 알림과 조회 실패를 구분하고 미읽음 개수 상한을 검사한다',()=>{
  expect(parseNotificationPage({items:[],nextCursor:null,unreadCount:0,readCutoff:time,readIds:[]})).not.toBeNull();
  expect(parseNotificationPage(null)).toBeNull();
  expect(parseUnreadState({unreadCount:0,readCutoff:time})).toEqual({unreadCount:0,readCutoff:time});
  expect(parseUnreadState({unreadCount:-1,readCutoff:time})).toBeNull();
});
it('개발자 테스트는 댓글 링크가 없는 별도 알림으로 검증한다',()=>{
  const testItem={...item,kind:'test',postId:null,commentId:null};
  expect(parseNotificationPage({...page,items:[testItem]})?.items[0]).toEqual(testItem);
  expect(parseNotificationPage({...page,items:[{...testItem,postId:id}]})).toBeNull();
  expect(parseNotificationPage({...page,items:[{...item,commentId:null}]})).toBeNull();
});
