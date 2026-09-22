import { describe, expect, it, vi } from 'vitest';
import { createResultCardShareClient } from '../../../src/journey/result-card/shareClient';

describe('result card share client', () => {
  it('posts only the prepared PNG to the dedicated share function', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      token: 'ABCD1234_ABCD1234_ABCD1234_ABCD1234', expiresAt: '2026-09-23T12:00:00.000Z',
    }), { status: 201, headers: { 'content-type': 'application/json' } }));
    const client = createResultCardShareClient({
      supabaseUrl: 'https://example.supabase.co',
      accessToken: async () => 'user-jwt',
      fetcher,
    });
    const png = new Blob(['PNG'], { type: 'image/png' });

    await expect(client.create(png, '00000000-0000-4000-8000-000000000001', 'ABCD1234_ABCD1234_ABCD1234_ABCD1234', new AbortController().signal)).resolves.toEqual({
      token: 'ABCD1234_ABCD1234_ABCD1234_ABCD1234', expiresAt: '2026-09-23T12:00:00.000Z',
    });
    expect(fetcher).toHaveBeenCalledWith('https://example.supabase.co/functions/v1/result-card-share', expect.objectContaining({
      method: 'POST',
      body: png,
      headers: expect.objectContaining({
        authorization: 'Bearer user-jwt',
        'content-type': 'image/png',
        'x-result-card-request-id': '00000000-0000-4000-8000-000000000001',
        'x-result-card-token': 'ABCD1234_ABCD1234_ABCD1234_ABCD1234',
      }),
    }));
  });

  it('does not present a link when the share service returns an invalid payload', async () => {
    const client = createResultCardShareClient({
      supabaseUrl: 'https://example.supabase.co',
      accessToken: async () => 'user-jwt',
      fetcher: async () => new Response('{}', { status: 201, headers: { 'content-type': 'application/json' } }),
    });

    await expect(client.create(new Blob(['PNG'], { type: 'image/png' }), '00000000-0000-4000-8000-000000000002', 'ABCD1234_ABCD1234_ABCD1234_ABCD1234', new AbortController().signal))
      .rejects.toThrow('공유 링크를 만들지 못했습니다.');
  });
});

it.each([
  [413, 'image_too_large', '이미지가 커서 링크로 공유할 수 없어요. 이미지로 저장해 주세요.'],
  [503, 'capacity_reached', '지금은 공유 링크를 만들 수 없어요. 이미지로 저장해 주세요.'],
  [503, 'cleanup_unhealthy', '지금은 공유 링크를 만들 수 없어요. 이미지로 저장해 주세요.'],
  [202, 'share_pending', '공유 링크를 준비하고 있어요. 잠시 뒤 다시 시도해 주세요.'],
  [410, 'share_expired', '이전 공유 요청이 끝났어요. 새 링크를 만들어 주세요.'],
])('maps status %s/%s to an actionable message', async (status, code, message) => {
  const client = createResultCardShareClient({supabaseUrl: 'https://example.supabase.co', accessToken: async () => 'jwt',
    fetcher: async () => Response.json({code}, {status})});
  await expect(client.create(new Blob(['png'], {type:'image/png'}), 'id', 'a'.repeat(43), new AbortController().signal))
    .rejects.toMatchObject({code, message});
});
it('keeps an oversized local image out of the share request', async () => {
  const fetcher=vi.fn();
  const client=createResultCardShareClient({supabaseUrl:'https://example.supabase.co',accessToken:async()=>'jwt',fetcher});
  await expect(client.create(new Blob([new Uint8Array(1_000_001)], {type:'image/png'}), 'id', 'a'.repeat(43), new AbortController().signal)).rejects.toMatchObject({code:'image_too_large'});
  expect(fetcher).not.toHaveBeenCalled();
});
