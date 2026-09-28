import {useState} from 'react';
import {externalBrowserLinks} from './externalBrowser';

export function KakaoBrowserNotice({reauthenticate = false}: {reauthenticate?: boolean}) {
  const links = externalBrowserLinks(window.location.href, import.meta.env.BASE_URL);
  const [copied, setCopied] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);
  async function copyAddress() {
    if (!links) return;
    try {await navigator.clipboard.writeText(links.url); setCopied(true); setManualCopy(false);}
    catch {setCopied(false); setManualCopy(true);}
  }
  return <section className="account-browser-notice" aria-label="카카오톡 브라우저 안내">
    <h2>브라우저에서 계속하기</h2>
    <p>카카오톡에서는 평소 브라우저의 로그인 상태가 이어지지 않아요. 외부 브라우저에서 이 페이지를 열어 주세요.</p>
    {reauthenticate ? <p>저장하지 않은 입력은 다른 브라우저로 옮겨지지 않아요.</p> : null}
    {links ? <div className="account-browser-actions">
      <button type="button" className="account-browser-copy" onClick={() => void copyAddress()}>주소 복사</button>
      <a className="account-external-browser" href={links.kakao}>외부 브라우저로 열기</a>
    </div> : null}
    <p className="account-browser-help">열리지 않으면 카카오톡 메뉴(⋯)에서 ‘다른 브라우저로 열기’를 선택하거나, 주소를 복사해 평소 쓰는 브라우저에 붙여 넣어 주세요.</p>
    {copied ? <p role="status">주소를 복사했어요.</p> : null}
    {manualCopy && links ? <div className="account-browser-address"><label htmlFor="external-browser-address">브라우저에서 열 주소</label>
      <input id="external-browser-address" readOnly value={links.url} onFocus={event => event.currentTarget.select()} />
      <span role="status">자동 복사가 안 됐어요. 주소를 선택해 직접 복사해 주세요.</span>
    </div> : null}
  </section>;
}
