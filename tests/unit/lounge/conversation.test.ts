import {describe, expect, it} from 'vitest';
import {parseCommentWrite, parseConversationPage, parseCommentContext, parseMentionCandidates} from '../../../src/lounge/domain/conversation';

const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const postId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const publicId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const createdAt='2026-09-28T01:00:00Z';
const write={id,postId,rootId:null,replyToId:null,body:'😀 @a@b 안녕',mentions:[{start:2,end:6,publicId,label:'a@b'}]};
const comment={id,rootId:null,replyToId:null,replyToAuthor:null,author:{publicId,nickname:'새이름'},body:write.body,
  mentions:[{...write.mentions[0],currentNickname:'바뀐이름'}],createdAt,deleted:false,isMine:true,replyCount:2};

describe('대화 계약',()=>{
  it('emoji 다음 code point 멘션과 @가 포함된 닉네임을 구분한다',()=>{
    expect(parseCommentWrite(write)).toEqual(write);
    expect(parseCommentWrite({...write,mentions:[{...write.mentions[0],start:3}]})).toBeNull();
    expect(parseCommentWrite({...write,body:'😀 @a@c 안녕'})).toBeNull();
  });
  it('일반 @문자열은 멘션을 생성하지 않는다',()=>{
    expect(parseCommentWrite({...write,mentions:[]})).toEqual({...write,mentions:[]});
  });
  it('위조 필드, 중복 대상, 범위 겹침, 다른 요청 구조를 거부한다',()=>{
    for(const bad of [
      {...write,ownerId:publicId}, {...write,mentions:[...write.mentions,...write.mentions]},
      {...write,rootId:id,replyToId:id}, {...write,rootId:postId,replyToId:null},
      {...write,rootId:null,replyToId:postId}, {...write,mentions:[{...write.mentions[0],end:999}]},
      {...write,mentions:[{...write.mentions[0],userId:publicId}]},
      {...write,body:'@가나 @가나',mentions:[{start:0,end:3,publicId,label:'가나'},{start:4,end:7,publicId:publicId.toUpperCase(),label:'가나'}]},
    ]) expect(parseCommentWrite(bad)).toBeNull();
  });
  it('문자수·바이트·금지문자·멘션 메타데이터 상한을 적용한다',()=>{
    expect(parseCommentWrite({...write,body:'😀'.repeat(500),mentions:[]})).not.toBeNull();
    for(const body of ['', '  ', 'x'.repeat(501), 'a\tb', 'a\u202eb'])
      expect(parseCommentWrite({...write,body,mentions:[]})).toBeNull();
    expect(parseCommentWrite({...write,mentions:Array(4).fill(write.mentions[0])})).toBeNull();
  });
  it('삭제 자리에는 이전 본문·작성자·멘션이 남지 않는다',()=>{
    const tombstone={...comment,body:'',author:null,mentions:[],deleted:true,isMine:false};
    expect(parseConversationPage({comments:[tombstone],nextCursor:null})).not.toBeNull();
    expect(parseConversationPage({comments:[{...tombstone,body:'옛 글'}],nextCursor:null})).toBeNull();
    expect(parseConversationPage({comments:[{...tombstone,author:comment.author}],nextCursor:null})).toBeNull();
  });
  it('현재 멘션 닉네임은 옛 본문과 분리하고 페이지 중복과 비공개 필드를 거부한다',()=>{
    expect(parseConversationPage({comments:[comment],nextCursor:{id,createdAt}})?.comments[0].mentions[0].currentNickname).toBe('바뀐이름');
    expect(parseConversationPage({comments:[comment,comment],nextCursor:null})).toBeNull();
    expect(parseConversationPage({comments:[{...comment,userId:publicId}],nextCursor:null})).toBeNull();
    expect(parseConversationPage({comments:[comment],nextCursor:{id:'bad',createdAt}})).toBeNull();
  });
  it('다른 페이지에 있는 답글 대상도 공개 작성자로 식별한다',()=>{
    const reply={...comment,id:publicId,rootId:id,replyToId:postId,replyToAuthor:comment.author,replyCount:0};
    expect(parseConversationPage({comments:[reply],nextCursor:null})?.comments[0].replyToAuthor).toEqual(comment.author);
    expect(parseConversationPage({comments:[{...reply,replyToAuthor:{...comment.author,userId:id}}],nextCursor:null})).toBeNull();
  });
  it('직접 이동 응답은 올바른 원댓글·대상·답글 묶음이어야 한다',()=>{
    const reply={...comment,id:publicId,rootId:id,replyToId:id,replyCount:0};
    const context={postId,root:comment,page:{comments:[reply],nextCursor:null},targetId:publicId,previousCursor:null};
    expect(parseCommentContext(context)).not.toBeNull();
    expect(parseCommentContext({...context,targetId:postId})).toBeNull();
    expect(parseCommentContext({...context,page:{comments:[{...reply,rootId:postId}],nextCursor:null}})).toBeNull();
  });
  it('사용자 후보는 최대 5명의 공개 ID·닉네임만 허용한다',()=>{
    expect(parseMentionCandidates([{publicId,nickname:'a@b'}])).toEqual([{publicId,nickname:'a@b'}]);
    expect(parseMentionCandidates([{publicId,nickname:'a@b',email:'secret@example.com'}])).toBeNull();
    expect(parseMentionCandidates(Array(6).fill({publicId,nickname:'a@b'}))).toBeNull();
  });
});
