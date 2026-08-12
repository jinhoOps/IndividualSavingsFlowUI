import { animate } from 'animejs';
import { useRef } from 'react';
import type { JSX } from 'react';
import { AppShell } from '../../components/common/AppShell';
import { MOTION_DISTANCE_PX, MOTION_DURATION, MOTION_EASE } from '../../components/motion/tokens';
import { useAnimeScope } from '../../components/motion/useAnimeScope';
import { appPath } from '../routes';
import { AppManagementMenu } from './AppManagementMenu';

export function ReadinessApp(): JSX.Element {
  const revealPlayedRef = useRef(false);
  const revealElementRef = useRef<HTMLElement | null>(null);
  const contentMotionRef = useAnimeScope<HTMLElement>(({ root, reducedMotion }) => {
    const isStrictModeReplay = revealPlayedRef.current && revealElementRef.current === root;
    if (reducedMotion || (revealPlayedRef.current && !isStrictModeReplay)) {
      setRevealFinalState(root);
      return;
    }
    revealPlayedRef.current = true;
    revealElementRef.current = root;
    try {
      animate(root, {
        opacity: [0, 1],
        y: [MOTION_DISTANCE_PX.reveal, 0],
        duration: MOTION_DURATION.normal,
        ease: MOTION_EASE.enter,
      });
    } catch {
      setRevealFinalState(root);
    }
  }, []);

  return (
    <AppShell
      currentApp="account-map"
      managementMenu={<AppManagementMenu items={[
          { kind: 'message', id: 'account-map-empty', text: '아직 관리할 설정이 없습니다' },
      ]} />}
    >
      <main className="journey-readiness" aria-labelledby="readiness-title">
        <section ref={contentMotionRef} className="journey-readiness__content" data-readiness-motion>
          <p>ISF 앱 준비 화면</p>
          <h1 id="readiness-title">Account Map 준비 중</h1>
          <p className="journey-message">Account Map은 Main과 분리된 신규 앱으로 설계될 예정입니다.</p>
          <a className="journey-action journey-action--secondary" href={appPath('main')}>
            Main으로 이동
          </a>
        </section>
      </main>
    </AppShell>
  );
}

function setRevealFinalState(target: HTMLElement): void {
  target.style.opacity = '1';
  target.style.transform = 'translateY(0px)';
}
