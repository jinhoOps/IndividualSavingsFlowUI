export interface LoungeProfile {nickname: string}
export interface NicknameSettings extends LoungeProfile {version: number; nextChangeAt: string | null; serverNow: string}
export const NICKNAME_RULE = '2~20자 · 한글, 영문, 숫자와 - . @만 사용할 수 있어요.';

export function parseNickname(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 60) return null;
  const nickname = value.normalize('NFC');
  return nickname.length >= 2 && nickname.length <= 20 && !/[^A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ.@-]/.test(nickname)
    && /[A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ]/.test(nickname) ? nickname : null;
}
export function parseNicknameSettings(value: unknown): NicknameSettings | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).sort().join(',') !== 'nextChangeAt,nickname,serverNow,version'
    || !parseNickname(row.nickname) || !Number.isSafeInteger(row.version) || Number(row.version) < 1
    || typeof row.serverNow !== 'string' || !Number.isFinite(Date.parse(row.serverNow))
    || (row.nextChangeAt !== null && (typeof row.nextChangeAt !== 'string' || !Number.isFinite(Date.parse(row.nextChangeAt))))) return null;
  return {nickname: parseNickname(row.nickname)!, version: Number(row.version), nextChangeAt: row.nextChangeAt as string | null, serverNow: row.serverNow};
}
export function parseLoungeProfile(value: unknown): LoungeProfile | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)
    || Object.keys(value).join(',') !== 'nickname') return null;
  const nickname = parseNickname((value as Record<string, unknown>).nickname);
  return nickname ? {nickname} : null;
}
