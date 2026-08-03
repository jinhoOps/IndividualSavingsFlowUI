import { useEffect, useRef } from 'react';
import { appPath, type JourneyApp } from '../routes';
import './journey.css';

export interface AppLauncherProps {
  currentApp: JourneyApp;
}

const apps: ReadonlyArray<{ id: JourneyApp; label: string }> = [
  { id: 'main', label: 'Main' },
  { id: 'simulation', label: 'Simulation' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'account-map', label: 'Account Map' },
];

export function AppLauncher({ currentApp }: AppLauncherProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;

    const desktopQuery = window.matchMedia('(min-width: 768px)');
    const syncDesktopState = () => {
      if (detailsRef.current !== null) {
        detailsRef.current.open = desktopQuery.matches;
      }
    };

    syncDesktopState();
    desktopQuery.addEventListener('change', syncDesktopState);
    return () => desktopQuery.removeEventListener('change', syncDesktopState);
  }, []);

  return (
    <nav className="journey-launcher" aria-label="ISF 앱">
      <details ref={detailsRef}>
        <summary>ISF 앱 메뉴</summary>
        <ul>
          {apps.map(({ id, label }) => {
            const isCurrent = id === currentApp;
            const availability = id === 'account-map' ? '준비 중' : '사용 중';
            return (
              <li key={id}>
                <a href={appPath(id)} aria-current={isCurrent ? 'page' : undefined}>
                  <span className="journey-launcher__destination">{label} {availability}</span>
                  {isCurrent ? (
                    <span className="journey-launcher__current">현재 위치</span>
                  ) : null}
                </a>
              </li>
            );
          })}
        </ul>
      </details>
    </nav>
  );
}
