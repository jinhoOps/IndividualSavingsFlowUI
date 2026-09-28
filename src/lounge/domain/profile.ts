export interface LoungeProfile {nickname: string}
export const NICKNAME_RULE = '2~20자 · 한글, 영문, 숫자와 - . @만 사용할 수 있어요.';

export function parseNickname(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const nickname = value.normalize('NFC');
  return nickname.length >= 2 && nickname.length <= 20 && !/[^A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ.@-]/.test(nickname)
    && /[A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ]/.test(nickname) ? nickname : null;
}
export function parseLoungeProfile(value: unknown): LoungeProfile | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)
    || Object.keys(value).join(',') !== 'nickname') return null;
  const nickname = parseNickname((value as Record<string, unknown>).nickname);
  return nickname ? {nickname} : null;
}
