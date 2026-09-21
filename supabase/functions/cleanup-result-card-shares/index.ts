import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.115.0';

const bucket = 'result-card-shares';

Deno.serve(async request => {
  if (request.method !== 'POST' || request.headers.get('x-result-card-cleanup') !== Deno.env.get('RESULT_CARD_CLEANUP_SECRET')) {
    return new Response(null, {status: 401});
  }
  const client = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'));
  const now = new Date();
  const pendingBefore = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  const expired = await client.from('result_card_shares').select('id,object_path').or(`expires_at.lte.${now.toISOString()},and(state.eq.pending,created_at.lte.${pendingBefore})`).limit(100);
  if (expired.error) return new Response(JSON.stringify({error: 'unavailable'}), {status: 503});
  let removed = 0;
  for (const record of expired.data ?? []) {
    const deleted = await client.storage.from(bucket).remove([record.object_path]);
    if (deleted.error) continue;
    const metadata = await client.from('result_card_shares').delete().eq('id', record.id);
    if (!metadata.error) removed += 1;
  }
  return Response.json({removed}, {headers: {'cache-control': 'no-store'}});
});
function required(key: string): string { const value = Deno.env.get(key); if (!value) throw new Error(`${key} is required`); return value; }
