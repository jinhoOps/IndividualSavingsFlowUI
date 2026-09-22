export class ResultCardShareError extends Error {
  constructor(public readonly code: string, message: string, public readonly retryAt?: string) { super(message); }
}
const imageTooLarge = () => new ResultCardShareError('image_too_large', '이미지가 커서 링크로 공유할 수 없어요. 이미지로 저장해 주세요.');

export interface ResultCardShareClient {
  create(png: Blob, requestId: string, shareToken: string, signal: AbortSignal): Promise<{ token: string; expiresAt: string }>;
}

export function createResultCardShareClient({
  supabaseUrl,
  accessToken,
  fetcher = fetch,
}: {
  supabaseUrl: string;
  accessToken: () => Promise<string | null>;
  fetcher?: typeof fetch;
}): ResultCardShareClient {
  return {
    async create(png, requestId, shareToken, signal) {
      if (png.type !== 'image/png' || png.size === 0 || !requestId || !/^[A-Za-z0-9_-]{32,}$/.test(shareToken)) throw new Error('공유 링크를 만들지 못했습니다.');
      if (png.size > 1_000_000) throw imageTooLarge();
      const token = await accessToken();
      if (!token) throw new Error('로그인 상태를 확인한 뒤 다시 시도해 주세요.');
      let response: Response;
      try {
        response = await fetcher(`${supabaseUrl}/functions/v1/result-card-share`, {
          method: 'POST',
          body: png,
          signal,
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'image/png',
            'x-result-card-request-id': requestId,
            'x-result-card-token': shareToken,
          },
        });
      } catch (error) {
        if ((error as {name?: string}).name === 'AbortError') throw error;
        throw new Error('공유 링크를 만들지 못했습니다.');
      }
      if (!response.ok || response.status === 202) throw await errorFor(response);
      let body: unknown;
      try { body = await response.json(); } catch { throw new Error('공유 링크를 만들지 못했습니다.'); }
      if (!isShareResponse(body)) throw new Error('공유 링크를 만들지 못했습니다.');
      return body;
    },
  };
}

function isShareResponse(value: unknown): value is {token: string; expiresAt: string} {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as {token?: unknown; expiresAt?: unknown};
  return typeof candidate.token === 'string' && /^[A-Za-z0-9_-]{32,}$/.test(candidate.token)
    && typeof candidate.expiresAt === 'string' && Number.isFinite(Date.parse(candidate.expiresAt));
}

async function errorFor(response: Response): Promise<ResultCardShareError> {
  const body: {code?: string; retryAt?: string} = await response.json().catch(() => ({}));
  const code = typeof body.code === 'string' ? body.code : 'unavailable';
  if (response.status === 401) return new ResultCardShareError(code, '로그인 상태를 확인한 뒤 다시 시도해 주세요.');
  if (response.status === 413) return imageTooLarge();
  if (response.status === 202) return new ResultCardShareError('share_pending', '공유 링크를 준비하고 있어요. 잠시 뒤 다시 시도해 주세요.');
  if (response.status === 410) return new ResultCardShareError('share_expired', '이전 공유 요청이 끝났어요. 새 링크를 만들어 주세요.');
  if (response.status === 429) {
    const retryAt = typeof body.retryAt === 'string' && Number.isFinite(Date.parse(body.retryAt)) ? body.retryAt : undefined;
    return new ResultCardShareError('daily_limit', retryAt
      ? `${new Date(retryAt).toLocaleString('ko-KR')}부터 다시 만들 수 있어요. 이미지로 저장할 수도 있어요.`
      : '오늘 만들 수 있는 공유 링크 수를 모두 사용했어요. 이미지로 저장해 주세요.', retryAt);
  }
  if (code === 'capacity_reached' || code === 'cleanup_unhealthy') return new ResultCardShareError(code, '지금은 공유 링크를 만들 수 없어요. 이미지로 저장해 주세요.');
  return new ResultCardShareError(code, '공유 링크를 만들지 못했습니다.');
}
