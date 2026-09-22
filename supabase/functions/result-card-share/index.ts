import { authenticatedUser, BUCKET, json, readLimitedPng, serviceClient, sha256 } from '../_shared/resultCardShare.ts';

export async function handleRequest(request:Request):Promise<Response>{
 const headers=responseHeaders(request);
 try{
  if(request.method==='OPTIONS')return new Response(null,{headers});
  if(request.method==='POST')return await createShare(request,headers);
  if(request.method==='GET')return await readShare(request,headers);
  return json({code:'method_not_allowed'},405,headers);
 }catch(error){
  if(error instanceof Response)return new Response(error.body,{status:error.status,headers});
  return json({code:'unavailable'},503,headers);
 }
}
if(import.meta.main)Deno.serve(handleRequest);

async function createShare(request:Request,headers:Headers):Promise<Response>{
 const user=await authenticatedUser(request);if(!user)return json({code:'unauthorized'},401,headers);
 const requestId=request.headers.get('x-result-card-request-id')??'',token=request.headers.get('x-result-card-token')??'';
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)||!/^[A-Za-z0-9_-]{32,128}$/.test(token)||request.headers.get('content-type')?.split(';')[0]!=='image/png')return json({code:'invalid'},400,headers);
 const png=await readLimitedPng(request),service=serviceClient();
 const {data:reservation,error}=await service.rpc('reserve_result_card_share',{p_owner_id:user.id,p_request_id:requestId,p_token_hash:await sha256(token),p_content_sha256:await sha256(png),p_byte_size:png.byteLength});
 if(error||!reservation)return json({code:'unavailable'},503,headers);
 if(reservation.status==='ready')return json({token,expiresAt:reservation.expiresAt},201,headers);
 if(reservation.status!=='reserved'){
  const outcomes:Record<string,[number,string]>={pending:[202,'share_pending'],expired:[410,'share_expired'],conflict:[409,'request_conflict'],daily_limit:[429,'daily_limit'],capacity_reached:[503,'capacity_reached'],cleanup_unhealthy:[503,'cleanup_unhealthy']};
  const [status,code]=outcomes[reservation.status]??[503,'unavailable'];
  if(status===202)headers.set('retry-after','3');
  return json({code,...(reservation.retryAt?{retryAt:reservation.retryAt}:{})},status,headers);
 }
 const upload=await service.storage.from(BUCKET).upload(reservation.objectPath,png,{contentType:'image/png',cacheControl:'0',upsert:false});
 if(upload.error)return json({code:'unavailable'},503,headers);
 // Unknown upload/publish outcomes remain charged; only settled files can release capacity.
 const published=await service.rpc('publish_result_card_share',{p_id:reservation.id});
 if(published.error)return json({code:'unavailable'},503,headers);
 if(published.data?.status!=='ready')return json({code:'share_expired'},410,headers);
 return json({token,expiresAt:published.data.expiresAt},201,headers);
}
async function readShare(request:Request,headers:Headers):Promise<Response>{
 const token=request.headers.get('x-result-card-share')??'';
 if(!/^[A-Za-z0-9_-]{32,128}$/.test(token))return new Response(null,{status:404,headers});
 const service=serviceClient();
 const {data,error}=await service.from('result_card_shares').select('object_path,expires_at').eq('token_hash',await sha256(token)).eq('state','ready').not('owner_id','is',null).gt('expires_at',new Date().toISOString()).maybeSingle();
 if(error)return json({code:'unavailable'},503,headers);
 if(!data)return new Response(null,{status:410,headers});
 const file=await service.storage.from(BUCKET).download(data.object_path);
 if(file.error||!file.data)return json({code:'unavailable'},503,headers);
 if(Date.parse(data.expires_at)<=Date.now())return new Response(null,{status:410,headers});
 headers.set('content-type','image/png');headers.set('x-result-card-expires-at',data.expires_at);
 return new Response(file.data,{headers});
}
function responseHeaders(request:Request):Headers{
 const headers=new Headers({'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff',vary:'origin'});
 const origins=(Deno.env.get('RESULT_CARD_ALLOWED_ORIGINS')??'https://jinhoops.github.io,http://localhost:5173').split(',').map(v=>v.trim());
 const origin=request.headers.get('origin');if(origin&&origins.includes(origin))headers.set('access-control-allow-origin',origin);
 headers.set('access-control-allow-headers','authorization,content-type,x-result-card-request-id,x-result-card-token,x-result-card-share');
 headers.set('access-control-expose-headers','x-result-card-expires-at,retry-after');headers.set('access-control-allow-methods','GET,POST,OPTIONS');return headers;
}
