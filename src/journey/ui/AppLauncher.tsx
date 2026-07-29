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
  return (
    <nav className="journey-launcher" aria-label="ISF 앱">
      <details>
        <summary>ISF 앱 메뉴</summary>
        <ul>
          {apps.map(({ id, label }) => {
            const isCurrent = id === currentApp;
            return (
              <li key={id}>
                <a href={appPath(id)} aria-current={isCurrent ? 'page' : undefined}>
                  <span>{label} {isCurrent ? '사용 중' : '준비 중'}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </details>
    </nav>
  );
}
