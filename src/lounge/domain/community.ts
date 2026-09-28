import {publicationId} from './publication';
import {parseNickname} from './profile';

export const EMOJIS = [
  {id:'like',symbol:'👍',label:'좋아요'}, {id:'heart',symbol:'❤️',label:'마음에 들어요'},
  {id:'fire',symbol:'🔥',label:'열정적이에요'}, {id:'clap',symbol:'👏',label:'멋져요'},
  {id:'idea',symbol:'💡',label:'참고할게요'}, {id:'think',symbol:'🤔',label:'생각해 볼게요'},
  {id:'wow',symbol:'😮',label:'놀라워요'}, {id:'target',symbol:'🎯',label:'목표가 뚜렷해요'},
  {id:'rocket',symbol:'🚀',label:'성장이 기대돼요'}, {id:'strong',symbol:'💪',label:'응원해요'},
  {id:'thanks',symbol:'🙏',label:'고마워요'}, {id:'smile',symbol:'😊',label:'좋은 구성이에요'},
  {id:'check',symbol:'✅',label:'공감해요'}, {id:'eyes',symbol:'👀',label:'관심 있어요'},
  {id:'diamond',symbol:'💎',label:'오래 간직해요'}, {id:'seed',symbol:'🌱',label:'차근차근 모아요'},
] as const;
export type EmojiId = typeof EMOJIS[number]['id'];
export const MAX_REACTION_TYPES = 8;
export const COMMENT_PAGE_SIZE = 20;
export interface Reaction {emoji: EmojiId; count: number; mine: boolean}
export interface CommunitySummary {postId: string; reactions: Reaction[]; commentCount: number; uniqueReactors: number}
export interface LoungeComment {id: string; nickname: string; body: string; createdAt: string; isMine: boolean}
export interface CommentCursor {id: string; createdAt: string}
export interface CommentPage {comments: LoungeComment[]; hasMore: boolean}

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, expected: string[]) => Object.keys(value).sort().join(',') === expected.sort().join(',');
const bounded = (value: unknown, max: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max;
export const isEmojiId = (value: unknown): value is EmojiId => EMOJIS.some(emoji => emoji.id === value);
const validCommentText = (body: string) => body.trim().length > 0 && [...body].length <= 500
  && new TextEncoder().encode(body).length <= 2000 && !/[\u0000-\u0009\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(body);
export function parseCommentBody(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const body = value.replace(/\r\n/g, '\n').trim();
  return validCommentText(body) ? body : null;
}
export function parseCommunitySummary(value: unknown): CommunitySummary | null {
  if (!record(value) || !keys(value,['postId','reactions','commentCount','uniqueReactors']) || !publicationId(value.postId)
    || !bounded(value.commentCount,500) || !bounded(value.uniqueReactors,5000) || !Array.isArray(value.reactions)
    || value.reactions.length > MAX_REACTION_TYPES) return null;
  const reactions: Reaction[] = [];
  for (const item of value.reactions) {
    if (!record(item) || !keys(item,['emoji','count','mine']) || !isEmojiId(item.emoji) || !bounded(item.count,5000)
      || item.count === 0 || typeof item.mine !== 'boolean' || reactions.some(r => r.emoji === item.emoji)) return null;
    reactions.push({emoji:item.emoji,count:item.count,mine:item.mine});
  }
  if (value.uniqueReactors < Math.max(0,...reactions.map(r=>r.count)) || value.uniqueReactors > reactions.reduce((n,r)=>n+r.count,0)) return null;
  return {postId:value.postId,reactions,commentCount:value.commentCount,uniqueReactors:value.uniqueReactors};
}
export function parseComment(value: unknown): LoungeComment | null {
  if (!record(value) || !keys(value,['id','nickname','body','createdAt','isMine']) || !publicationId(value.id)
    || typeof value.nickname !== 'string' || parseNickname(value.nickname) !== value.nickname
    || typeof value.body !== 'string' || !validCommentText(value.body)
    || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) || typeof value.isMine !== 'boolean') return null;
  return {id:value.id,nickname:value.nickname,body:value.body,createdAt:value.createdAt,isMine:value.isMine};
}
export function parseCommentPage(value: unknown): CommentPage | null {
  if (!record(value) || !keys(value,['comments','hasMore']) || !Array.isArray(value.comments)
    || value.comments.length > COMMENT_PAGE_SIZE || typeof value.hasMore !== 'boolean') return null;
  const comments = value.comments.map(parseComment);
  if (comments.some(c=>c===null) || new Set(comments.map(c=>c?.id)).size !== comments.length
    || (value.hasMore && comments.length !== COMMENT_PAGE_SIZE)) return null;
  return {comments:comments as LoungeComment[],hasMore:value.hasMore};
}
