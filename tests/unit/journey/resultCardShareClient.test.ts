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
