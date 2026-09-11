import {createRoot} from 'react-dom/client';
import {completeAuthCallback, getBrowserClient, readSupabaseConfig, RETURN_PATH_KEY, safeReturnPath} from './auth';
import '../styles/app-foundation.css';
import './account.css';
import {markLoginLoading} from './loginLoadingIntent';

const root = createRoot(document.getElementById('root')!);
root.render(<main className="account-gate"><section className="account-panel" role="status"><h1>로그인 확인 중입니다.</h1></section></main>);
void (async () => {
  let ok = false;
  try {
    const client = getBrowserClient(readSupabaseConfig(import.meta.env));
    ok = await completeAuthCallback(window.location.href, path => history.replaceState(null, '', path), code => client.auth.exchangeCodeForSession(code));
  } catch {history.replaceState(null, '', window.location.pathname);}
  let target = safeReturnPath(null, import.meta.env.BASE_URL);
  try {
    target = safeReturnPath(window.sessionStorage.getItem(RETURN_PATH_KEY), import.meta.env.BASE_URL);
    window.sessionStorage.removeItem(RETURN_PATH_KEY);
  } catch { /* Default route is usable even when storage is unavailable. */ }
  if (ok) {markLoginLoading(); window.location.replace(target);}
  else root.render(<main className="account-gate"><section className="account-panel"><h1>로그인을 완료하지 못했습니다.</h1><p>로그인을 시작했던 브라우저에서 다시 시도해주세요.</p><a href={target}>로그인 화면으로 돌아가기</a></section></main>);
})();
