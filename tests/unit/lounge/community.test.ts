import {describe, expect, it} from 'vitest';
import {EMOJIS, parseCommentBody, parseCommunitySummary, parseCommentPage} from '../../../src/lounge/domain/community';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const summary = {postId:id, reactions:[{emoji:'like',count:2,mine:true}], commentCount:1, uniqueReactors:2};
const comment = {id, nickname:'차곡차곡', body:'비율이 좋네요', createdAt:'2026-09-28T01:00:00.000Z', isMine:false};
describe('Lounge community boundary', () => {
  it('accepts bounded reaction counts and rejects duplicate/unknown or private fields', () => {
    expect(parseCommunitySummary(summary)).toEqual(summary);
    for (const value of [{...summary,owner_id:id},{...summary,reactions:[...summary.reactions,...summary.reactions]},
      {...summary,reactions:[{emoji:'<img>',count:1,mine:false}]},{...summary,reactions:[{emoji:'like',count:0,mine:false}]},
      {...summary,reactions:EMOJIS.slice(0,9).map(e=>({emoji:e.id,count:1,mine:false}))},
      {...summary,commentCount:501},{...summary,uniqueReactors:1},{...summary,uniqueReactors:3}]) {
      expect(parseCommunitySummary(value)).toBeNull();
    }
  });
  it('keeps multiline Korean, emoji and code-looking comments as literal bounded text', () => {
    expect(parseCommentBody('  한글\r\n😀  ')).toBe('한글\n😀');
    expect(parseCommentBody("<script>alert(1)</script> '; DROP TABLE x; --")).not.toBeNull();
    expect(parseCommentBody('😀'.repeat(500))).toHaveLength(1000);
    for (const value of ['', ' \n ', 'a'.repeat(501), '\u0000x', 'a\tb', 'a\u202eb', null]) expect(parseCommentBody(value)).toBeNull();
  });
  it('validates paginated public comments, unique ids and continuation cursors', () => {
    expect(parseCommentPage({comments:[comment],hasMore:false})).toEqual({comments:[comment],hasMore:false});
    for (const value of [{comments:[{...comment,user_id:id}],hasMore:false},{comments:[comment,comment],hasMore:false},
      {comments:[comment],hasMore:'yes'},{comments:[],hasMore:true},{comments:[{...comment,nickname:'<bad>'}],hasMore:false}]) {
      expect(parseCommentPage(value)).toBeNull();
    }
  });
});
