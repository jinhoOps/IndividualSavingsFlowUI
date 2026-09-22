import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.115.0';

const bucket = 'result-card-shares';
const maxBytes = 5 * 1024 * 1024;
const maxDailyShares = 20;

Deno.serve(async request => {
  const headers = responseHeaders(request);
  if (request.method === 'OPTIONS') return new Response(null, {headers});
  if (request.method === 'POST') return createShare(request, headers);
  if (request.method === 'GET') return readShare(request, headers);
  return new Response('Method not allowed', {status: 405, headers});
});

async function createShare(request: Request, headers: Headers): Promise<Response> {
  const user = await authenticatedUser(request);
  if (!user) return json({error: 'unauthorized'}, 401, headers);
  const requestId = request.headers.get('x-result-card-request-id') ?? '';
  const token = request.headers.get('x-result-card-token') ?? '';
  if (!isUuid(requestId) || !/^[A-Za-z0-9_-]{32,}$/.test(token)) return json({error: 'invalid'}, 400, headers);
  const png = new Uint8Array(await request.arrayBuffer());
  if (!isPngCard(png)) return json({error: 'invalid'}, 400, headers);
  const service = serviceClient();
  const tokenHash = await sha256(token);
  const existing = await service.from('result_card_shares').select('token_hash,state,expires_at')
    .eq('owner_id', user.id).eq('request_id', requestId).maybeSingle();
  if (existing.error) return json({error: 'unavailable'}, 503, headers);
  if (existing.data?.token_hash && existing.data.token_hash !== tokenHash) return json({error: 'invalid'}, 409, headers);
  if (existing.data?.state === 'ready' && existing.data.expires_at) {
    return json({token, expiresAt: existing.data.expires_at}, 201, headers);
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const quota = await service.from('result_card_shares').select('*', {count: 'exact', head: true})
    .eq('owner_id', user.id).gte('created_at', since);
  if (quota.error) return json({error: 'unavailable'}, 503, headers);
  if ((quota.count ?? 0) >= maxDailyShares) return json({error: 'quota'}, 429, headers);

  const id = crypto.randomUUID();
  const objectPath = `shares/${id}.png`;
  const reservation = await service.from('result_card_shares').insert({
    id, owner_id: user.id, request_id: requestId, token_hash: tokenHash, object_path: objectPath, state: 'pending',
  });
  if (reservation.error) return json({error: 'unavailable'}, 503, headers);
  const upload = await service.storage.from(bucket).upload(objectPath, png, {contentType: 'image/png', cacheControl: '0', upsert: false});
  if (upload.error) return json({error: 'unavailable'}, 503, headers);
  const publishedAt = new Date();
  const expiresAt = new Date(publishedAt.getTime() + 48 * 60 * 60 * 1000).toISOString();
  const published = await service.from('result_card_shares').update({state: 'ready', published_at: publishedAt.toISOString(), expires_at: expiresAt}).eq('id', id).eq('state', 'pending');
  if (published.error) {
    await service.storage.from(bucket).remove([objectPath]);
    return json({error: 'unavailable'}, 503, headers);
  }
  return json({token, expiresAt}, 201, headers);
}

async function readShare(request: Request, headers: Headers): Promise<Response> {
  const token = request.headers.get('x-result-card-share') ?? '';
  if (!/^[A-Za-z0-9_-]{32,}$/.test(token)) return new Response(null, {status: 404, headers});
  const service = serviceClient();
  const record = await service.from('result_card_shares').select('object_path,expires_at')
    .eq('token_hash', await sha256(token)).eq('state', 'ready').gt('expires_at', new Date().toISOString()).maybeSingle();
  if (record.error || !record.data) return new Response(null, {status: 410, headers});
  const file = await service.storage.from(bucket).download(record.data.object_path);
  if (file.error || !file.data) return new Response(null, {status: 410, headers});
  if (new Date(record.data.expires_at).getTime() <= Date.now()) return new Response(null, {status: 410, headers});
  headers.set('content-type', 'image/png');
  headers.set('x-result-card-expires-at', record.data.expires_at);
  return new Response(file.data, {status: 200, headers});
}

async function authenticatedUser(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const client = createClient(required('SUPABASE_URL'), required('SUPABASE_ANON_KEY'), {global: {headers: {Authorization: authorization}}});
  const {data, error} = await client.auth.getUser();
  return error ? null : data.user;
}
function serviceClient() { return createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY')); }
function required(key: string): string { const value = Deno.env.get(key); if (!value) throw new Error(`${key} is required`); return value; }
function isUuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function isPngCard(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 24 || bytes.byteLength > maxBytes) return false;
  const signature = [137,80,78,71,13,10,26,10];
  if (!signature.every((byte, index) => bytes[index] === byte)) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(16) === 1080 && view.getUint32(20) === 1440;
}
async function sha256(value: string): Promise<string> { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join(''); }
function responseHeaders(request: Request): Headers {
  const headers = new Headers({'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', vary: 'origin'});
  const origin = request.headers.get('origin');
  const origins = (Deno.env.get('RESULT_CARD_ALLOWED_ORIGINS') ?? 'https://jinhoops.github.io,http://localhost:5173').split(',').map(value => value.trim());
  if (origin && origins.includes(origin)) headers.set('access-control-allow-origin', origin);
  headers.set('access-control-allow-headers', 'authorization,content-type,x-result-card-request-id,x-result-card-token,x-result-card-share');
  headers.set('access-control-expose-headers', 'x-result-card-expires-at');
  headers.set('access-control-allow-methods', 'GET,POST,OPTIONS');
  return headers;
}
function json(body: unknown, status: number, headers: Headers): Response { headers.set('content-type', 'application/json'); return new Response(JSON.stringify(body), {status, headers}); }
