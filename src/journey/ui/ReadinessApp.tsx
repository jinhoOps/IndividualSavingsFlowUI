import type { JSX } from 'react';
import { appPath } from '../routes';
import { AppLauncher } from './AppLauncher';
import { AppManagementMenu } from './AppManagementMenu';

export function ReadinessApp(): JSX.Element {
  return (
    <main className="journey-readiness" aria-labelledby="readiness-title">
      <AppLauncher
        currentApp="account-map"
        managementMenu={<AppManagementMenu items={[
          { kind: 'message', id: 'account-map-empty', text: '아직 관리할 설정이 없습니다' },
        ]} />}
      />
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
