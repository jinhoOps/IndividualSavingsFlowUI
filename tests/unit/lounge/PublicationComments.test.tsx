import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {createRef} from 'react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {PublicationComments, type CommentNavigation} from '../../../src/lounge/ui/PublicationComments';
import type {ConversationComment, CommentContext} from '../../../src/lounge/domain/conversation';
import type {Publication} from '../../../src/lounge/domain/publication';
import type {LoungeRepository} from '../../../src/lounge/infrastructure/loungeRepository';

const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  frames.clear();
  vi.unstubAllGlobals();
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
});
function flushFrame() {
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback(16));
  });
}

const post: Publication = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: '공유 계획', note: '', alias: '작성자',
  version: 1, updatedAt: '2026-09-28T01:00:00Z', isMine: false,
  allocation: {items: [{name: '주식', shareUnits: 1000000}], cashShareUnits: 0},
};
const root: ConversationComment = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', rootId: null, replyToId: null, replyToAuthor: null,
  author: {publicId: post.id, nickname: '작성자'}, body: '질문', mentions: [],
  createdAt: post.updatedAt, deleted: false, isMine: false, replyCount: 20,
};
const reply: ConversationComment = {
  ...root, id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', rootId: root.id, replyToId: root.id,
  body: '알림으로 연 답글', replyCount: 0,
};
const context: CommentContext = {
  postId: post.id, root, targetId: reply.id, page: {comments: [reply], nextCursor: null},
  previousCursor: {id: reply.id, createdAt: reply.createdAt},
};
async function openComments() {
  const repository = {
    listThreads: vi.fn().mockResolvedValue({comments: [root], nextCursor: null}),
    listReplies: vi.fn().mockResolvedValue({comments: [{...reply, body: '이전 대화'}], nextCursor: null}),
  } as unknown as LoungeRepository;
  const onBack = vi.fn();
  await act(async () => {
    render(<PublicationComments repository={repository} post={post} onSummary={vi.fn()} onBack={onBack}
      onClose={vi.fn()} requestClose={vi.fn()} navigationRef={createRef<CommentNavigation>()}
      onBusyChange={vi.fn()} initialCommentId={reply.id} initialContext={context} />);
  });
  flushFrame();
  return {input: screen.getByLabelText('댓글 남기기'), onBack};
}
function resumeDraft(input: HTMLElement) {
  fireEvent.change(input, {target: {value: '계속 작성할 내용'}});
  fireEvent.click(screen.getByRole('button', {name: '뒤로'}));
  fireEvent.click(screen.getByRole('button', {name: '계속 작성'}));
  flushFrame();
}

it('keeps focus in the resumed composer after notification-target focus callbacks finish', async () => {
  const {input, onBack} = await openComments();
  expect(document.getElementById(`comment-${reply.id}`)).toHaveFocus();
  resumeDraft(input);
  expect(input).toHaveFocus();
  fireEvent.change(input, {target: {value: ''}});
  fireEvent.click(screen.getByRole('button', {name: '뒤로'}));
  expect(onBack).toHaveBeenCalledOnce();
});

it('preserves the reply page when returning from discard confirmation', async () => {
  const {input} = await openComments();
  await act(async () => {fireEvent.click(screen.getByRole('button', {name: '이전 답글'}));});
  expect(screen.getByText('이전 대화')).toBeVisible();
  resumeDraft(input);
  expect(screen.getByText('이전 대화')).toBeVisible();
});
