import {afterEach,describe,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {CommentComposer,editMentionDraft,insertMention} from '../../../src/lounge/ui/CommentComposer';
import type {ConversationRepository} from '../../../src/lounge/infrastructure/conversationRepository';

afterEach(()=>{cleanup();vi.useRealTimers();});
const candidate={publicId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',nickname:'a@b'};
describe('selected mention editing',()=>{
  it('keeps codepoint ranges after emoji, shifts preceding edits and unlinks edits inside the name',()=>{
    const draft=insertMention({body:'😀 hello ',mentions:[]},9,9,candidate);
    expect(draft.mentions[0]).toMatchObject({start:8,end:12,label:'a@b'});
    const shifted=editMentionDraft(draft,`앞 ${draft.body}`);
    expect(shifted.mentions[0].start).toBe(10);
    const edited=editMentionDraft(shifted,shifted.body.replace('@a@b','@a@c'));
    expect(edited.mentions).toEqual([]);
    expect(editMentionDraft(edited,shifted.body).mentions).toEqual([]); // undo does not invent identity
  });
  it('treats pasted names as text and normalizes composed text without corrupting a selected range',()=>{
    const draft=insertMention({body:'가 ',mentions:[]},3,3,candidate);
    expect(draft.body).toBe('가 @a@b ');
    expect(draft.mentions[0]).toMatchObject({start:2,end:6});
    expect(editMentionDraft({body:'',mentions:[]},'mail@a@b @a@b').mentions).toEqual([]);
  });
});
it('waits for IME completion, ignores stale candidates and inserts a nickname containing @',async()=>{
  vi.useFakeTimers();
  let resolveOld!:(value:typeof candidate[])=>void;
  const find=vi.fn().mockResolvedValueOnce([]).mockImplementationOnce(()=>new Promise(resolve=>{resolveOld=resolve;})).mockResolvedValue([candidate]);
  const repository={findMentionTargets:find} as unknown as ConversationRepository;
  render(<CommentComposer repository={repository} postId={candidate.publicId} disabled={false} onDirtyChange={()=>{}} onBusyChange={()=>{}} onSaved={()=>{}} />);
  fireEvent.click(screen.getByRole('button',{name:'사용자 멘션'}));
  await act(async()=>{await vi.advanceTimersByTimeAsync(300);});
  const search=screen.getByRole('combobox');
  fireEvent.compositionStart(search);fireEvent.change(search,{target:{value:'가'}});
  await act(async()=>{await vi.advanceTimersByTimeAsync(400);});expect(find).toHaveBeenCalledTimes(1);
  fireEvent.compositionEnd(search,{data:'가'});fireEvent.change(search,{target:{value:'가나'}});
  await act(async()=>{await vi.advanceTimersByTimeAsync(300);});
  fireEvent.change(search,{target:{value:'a@'}});
  await act(async()=>{await vi.advanceTimersByTimeAsync(300);});
  await act(async()=>{resolveOld([{...candidate,nickname:'옛후보'}]);});
  expect(screen.queryByText('옛후보')).toBeNull();
  fireEvent.click(screen.getByRole('option',{name:'a@b'}));
  expect((screen.getByLabelText('댓글 남기기') as HTMLTextAreaElement).value).toBe('@a@b ');
});
