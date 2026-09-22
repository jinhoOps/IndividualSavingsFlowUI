import { useEffect, useState } from 'react';
import { readSupabaseConfig } from '../../auth/config';
import { appPath } from '../routes';
import { sharedResultToken } from './token';

type PageState =
  | { kind: 'loading' }
  | { kind: 'ready'; imageUrl: string; expiresAt: string | null }
  | { kind: 'expired' }
  | { kind: 'error' };

export function SharedResultPage() {
  const [state, setState] = useState<PageState>({kind: 'loading'});
  useEffect(() => {
    const token = sharedResultToken(window.location.hash);
    if (!token) { setState({kind: 'expired'}); return; }
    let released = false;
    let objectUrl: string | null = null;
    const controller = new AbortController();
    void (async () => {
      try {
        const config = readSupabaseConfig(import.meta.env);
        const response = await fetch(`${config.url}/functions/v1/result-card-share`, {
          headers: {'x-result-card-share': token}, signal: controller.signal, cache: 'no-store',
        });
        if (response.status === 404 || response.status === 410) { if (!released) setState({kind: 'expired'}); return; }
        if (!response.ok) throw new Error('response');
        const image = await response.blob();
        if (image.type !== 'image/png' || image.size === 0) throw new Error('image');
        objectUrl = URL.createObjectURL(image);
        if (!released) setState({kind: 'ready', imageUrl: objectUrl, expiresAt: response.headers.get('x-result-card-expires-at')});
      } catch (error) {
        if (!released && (error as {name?: string}).name !== 'AbortError') setState({kind: 'error'});
      }
    })();
    return () => { released = true; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, []);

  return <main className="shared-result-page">
    <section className="shared-result-page__card" aria-live="polite">
      {state.kind === 'loading' ? <p>공유한 계획을 불러오고 있어요.</p> : null}
      {state.kind === 'ready' ? <><img src={state.imageUrl} alt="공유된 나의 자금 계획 이미지" />
        <p>{state.expiresAt ? `${new Date(state.expiresAt).toLocaleString('ko-KR')}까지 볼 수 있어요.` : '공유 기간 안에 볼 수 있어요.'}</p></> : null}
      {state.kind === 'expired' ? <><h1>공유 기간이 끝났거나 사용할 수 없는 링크예요.</h1><p>링크를 만든 사람에게 새 링크를 요청해 주세요.</p><a className="ui-button ui-button--primary" href={appPath('main')}>ISF에서 계획 보기</a></> : null}
      {state.kind === 'error' ? <><h1>공유한 계획을 불러오지 못했어요.</h1><p>네트워크를 확인한 뒤 다시 시도해 주세요.</p><button className="ui-button ui-button--primary" type="button" onClick={() => window.location.reload()}>다시 시도</button></> : null}
    </section>
  </main>;
}
