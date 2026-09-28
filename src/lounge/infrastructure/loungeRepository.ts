import {parseLoungeProfile, parseNickname, parseNicknameSettings, type LoungeProfile, type NicknameSettings} from '../domain/profile';
import type {SupabaseClient} from '@supabase/supabase-js';
import {getBrowserClient, readSupabaseConfig} from '../../auth/auth';
import {parsePublication, parsePublicationInput, publicationId, PUBLICATION_PAGE_SIZE, type Publication, type PublicationInput} from '../domain/publication';
import {isEmojiId, parseComment, parseCommentBody, parseCommentPage, parseCommunitySummary, type CommentCursor, type CommentPage, type CommunitySummary, type EmojiId, type LoungeComment} from '../domain/community';
export interface LoungeRepository {
  getProfile(): Promise<LoungeProfile | null>;
  registerNickname(nickname: string): Promise<LoungeProfile>;
  getNicknameSettings(): Promise<NicknameSettings>;
  changeNickname(nickname: string, expectedVersion: number): Promise<NicknameChangeResult>;
  list(mine: boolean, before?: Publication): Promise<Publication[]>;
  get(id: string): Promise<Publication | null>;
  publish(input: PublicationInput, expectedVersion: number | null): Promise<Publication>;
  remove(post: Publication): Promise<void>;
  getCommunity(postIds: string[]): Promise<CommunitySummary[]>;
  setReaction(postId: string, emoji: EmojiId, active: boolean): Promise<{status: 'saved' | 'reaction-limit'; summary: CommunitySummary}>;
  listComments(postId: string, before?: CommentCursor): Promise<CommentPage>;
  addComment(postId: string, id: string, body: string): Promise<{comment: LoungeComment; summary: CommunitySummary}>;
  removeComment(postId: string, id: string): Promise<CommunitySummary>;
}
export type NicknameChangeResult = {status: 'saved' | 'unchanged' | 'cooldown' | 'conflict'; profile: NicknameSettings};
export class LoungeError extends Error {
  constructor(public readonly code: 'conflict' | 'invalid' | 'unavailable' | 'account' | 'full' | 'nickname-taken' | 'profile-required' | 'rate-limited' | 'comment-limit' | 'missing' | 'forbidden') {super(code);}
}
export function loungeErrorMessage(error: unknown): string {
  if (error instanceof LoungeError) {
    if (error.code === 'rate-limited') return '잠시 후 다시 시도해 주세요.';
    if (error.code === 'comment-limit') return '이 게시물에 더 이상 댓글을 남길 수 없어요.';
    if (error.code === 'missing') return '삭제되었거나 더 이상 볼 수 없는 게시물이에요.';
    if (error.code === 'forbidden') return '내가 작성한 댓글만 삭제할 수 있어요.';
    if (error.code === 'nickname-taken') return '이미 사용 중인 닉네임이에요. 다른 이름을 입력해 주세요.';
    if (error.code === 'profile-required') return '라운지에서 닉네임을 먼저 설정해 주세요.';
    if (error.code === 'conflict') return '다른 곳에서 공유 내용이 바뀌었어요. 닫고 다시 열어 주세요.';
    if (error.code === 'invalid') return '공유할 이름과 비율을 확인해 주세요.';
    if (error.code === 'account') return '로그인 상태가 바뀌었어요. 새로고침해 주세요.';
    if (error.code === 'full') return '지금은 새 내용을 저장할 수 없어요. 잠시 후 다시 시도해 주세요.';
  }
  return '불러오거나 저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.';
}
export function browserLoungeRepository(): LoungeRepository {
  return createLoungeRepository(getBrowserClient(readSupabaseConfig(import.meta.env)));
}
export function createLoungeRepository(client: SupabaseClient): LoungeRepository {
  // Bind all requests to this mounted account, including requests queued during a switch.
  const identity = client.auth.getSession().then(({data, error}) => {
    return error ? null : data.session?.user.id ?? null;
  }, () => null);
  async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
    const userId = await identity;
    const {data: auth, error: authError} = await client.auth.getSession();
    if (!userId || authError || !auth.session || auth.session.user.id !== userId) throw new LoungeError('account');
    const {data, error} = await client.rpc(name, args).setHeader('Authorization', `Bearer ${auth.session.access_token}`).retry(false);
    if (error) throw new LoungeError('unavailable');
    return data;
  }
  const parse = (value: unknown) => {const post = parsePublication(value); if (!post) throw new LoungeError('invalid'); return post;};
  const profile = (value: unknown) => {const parsed = parseLoungeProfile(value); if (!parsed) throw new LoungeError('invalid'); return parsed;};
  const settings = (value: unknown) => {const parsed = parseNicknameSettings(value); if (!parsed) throw new LoungeError('invalid'); return parsed;};
  const community = (value: unknown, postId: string) => {
    const parsed = parseCommunitySummary(value);
    if (!parsed || parsed.postId !== postId) throw new LoungeError('invalid');
    return parsed;
  };
  const communityFailure = (status: unknown): never => {
    throw new LoungeError(status === 'rate-limited' || status === 'comment-limit' || status === 'missing' || status === 'forbidden'
      || status === 'full' || status === 'profile-required' || status === 'conflict' ? status : 'invalid');
  };
  return {
    async getCommunity(postIds) {
      if (postIds.length > 24 || !postIds.every(publicationId)) throw new LoungeError('invalid');
      const data = await rpc('get_lounge_community',{p_post_ids:postIds});
      if (!Array.isArray(data) || data.length > postIds.length) throw new LoungeError('invalid');
      const parsed = data.map(parseCommunitySummary);
      if (parsed.some(p=>!p || !postIds.includes(p.postId)) || new Set(parsed.map(p=>p?.postId)).size !== parsed.length) throw new LoungeError('invalid');
      return parsed as CommunitySummary[];
    },
    async setReaction(postId,emoji,active) {
      if (!publicationId(postId) || !isEmojiId(emoji) || typeof active !== 'boolean') throw new LoungeError('invalid');
      const data = await rpc('set_lounge_reaction',{p_post_id:postId,p_emoji:emoji,p_active:active}) as {status?: string; summary?: unknown};
      if (data?.status !== 'saved' && data?.status !== 'reaction-limit') return communityFailure(data?.status);
      return {status:data.status,summary:community(data.summary,postId)};
    },
    async listComments(postId,before) {
      if (!publicationId(postId) || (before && (!publicationId(before.id) || !Number.isFinite(Date.parse(before.createdAt))))) throw new LoungeError('invalid');
      const data = await rpc('list_lounge_comments',{p_post_id:postId,p_before_time:before?.createdAt ?? null,p_before_id:before?.id ?? null});
      if (data === null) throw new LoungeError('missing');
      const parsed = parseCommentPage(data); if (!parsed) throw new LoungeError('invalid');
      return parsed;
    },
    async addComment(postId,id,body) {
      const safe = parseCommentBody(body);
      if (!publicationId(postId) || !publicationId(id) || !safe) throw new LoungeError('invalid');
      const data = await rpc('add_lounge_comment',{p_post_id:postId,p_id:id,p_body:safe}) as {status?: string; comment?: unknown; summary?: unknown};
      if (data?.status !== 'saved') return communityFailure(data?.status);
      const comment = parseComment(data.comment);
      if (!comment || comment.id !== id || comment.body !== safe || !comment.isMine) throw new LoungeError('invalid');
      return {comment,summary:community(data.summary,postId)};
    },
    async removeComment(postId,id) {
      if (!publicationId(postId) || !publicationId(id)) throw new LoungeError('invalid');
      const data = await rpc('delete_lounge_comment',{p_post_id:postId,p_id:id}) as {status?: string; summary?: unknown};
      if (data?.status !== 'deleted') return communityFailure(data?.status);
      return community(data.summary,postId);
    },
    async getNicknameSettings() {
      const data = await rpc('get_lounge_profile_v2', {});
      if (data === null) throw new LoungeError('profile-required');
      return settings(data);
    },
    async changeNickname(nickname, expectedVersion) {
      const safe = parseNickname(nickname);
      if (!safe || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new LoungeError('invalid');
      const data = await rpc('change_lounge_nickname', {p_nickname: safe, p_expected_version: expectedVersion}) as {status?: string; profile?: unknown};
      if (data?.status === 'saved' || data?.status === 'unchanged' || data?.status === 'cooldown' || data?.status === 'conflict') return {status: data.status, profile: settings(data.profile)};
      throw new LoungeError(data?.status === 'taken' ? 'nickname-taken' : data?.status === 'profile-required' ? 'profile-required' : 'invalid');
    },
    async getProfile() {
      const data = await rpc('get_lounge_profile', {});
      return data === null ? null : profile(data);
    },
    async registerNickname(nickname) {
      const safe = parseNickname(nickname);
      if (!safe) throw new LoungeError('invalid');
      const data = await rpc('register_lounge_nickname', {p_nickname: safe}) as {status?: string; profile?: unknown};
      if (data?.status === 'saved' || data?.status === 'exists') return profile(data.profile);
      throw new LoungeError(data?.status === 'taken' ? 'nickname-taken' : data?.status === 'full' ? 'full' : 'invalid');
    },
    async list(mine, before) {
      const data = await rpc('list_lounge_portfolios_v2', {p_mine: mine, p_before_time: before?.updatedAt ?? null, p_before_id: before?.id ?? null, p_limit: PUBLICATION_PAGE_SIZE});
      if (!Array.isArray(data)) throw new LoungeError('invalid');
      return data.map(parse);
    },
    async get(id) {
      if (!publicationId(id)) throw new LoungeError('invalid');
      const data = await rpc('get_lounge_portfolio_v2', {p_id: id});
      return data === null ? null : parse(data);
    },
    async publish(input, expectedVersion) {
      const safe = parsePublicationInput(input);
      if (!safe) throw new LoungeError('invalid');
      const data = await rpc('publish_lounge_portfolio_v3', {p_title: safe.title, p_note: safe.note, p_allocation: safe.allocation, p_asset_band: safe.assetBand ?? null, p_expected_version: expectedVersion}) as {status?: string; post?: unknown};
      if (data?.status !== 'saved') throw new LoungeError(data?.status === 'conflict' ? 'conflict' : data?.status === 'full' ? 'full' : data?.status === 'profile-required' ? 'profile-required' : 'invalid');
      return parse(data.post);
    },
    async remove(post) {
      const data = await rpc('delete_lounge_portfolio', {p_id: post.id, p_expected_version: post.version}) as {status?: string};
      if (data?.status !== 'deleted') throw new LoungeError('conflict');
    },
  };
}
