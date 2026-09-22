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
      if (!response.ok) throw new Error(await messageFor(response));
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

async function messageFor(response: Response): Promise<string> {
  if (response.status === 401) return '로그인 상태를 확인한 뒤 다시 시도해 주세요.';
  if (response.status === 429) return '오늘 만들 수 있는 공유 링크 수를 모두 사용했어요. 잠시 뒤 다시 시도해 주세요.';
  return '공유 링크를 만들지 못했습니다.';
}
