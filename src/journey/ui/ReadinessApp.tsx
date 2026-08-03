import type { JSX } from 'react';
import { appPath } from '../routes';
import { AppLauncher } from './AppLauncher';

export function ReadinessApp(): JSX.Element {
  return (
    <main className="journey-readiness" aria-labelledby="readiness-title">
      <AppLauncher currentApp="account-map" />
      <section className="journey-readiness__content">
        <p>ISF 앱 준비 화면</p>
        <h1 id="readiness-title">Account Map 준비 중</h1>
        <p className="journey-message">Account Map은 Main과 분리된 신규 앱으로 설계될 예정입니다.</p>
        <a className="journey-action journey-action--secondary" href={appPath('main')}>
          Main으로 이동
        </a>
      </section>
    </main>
  );
}
