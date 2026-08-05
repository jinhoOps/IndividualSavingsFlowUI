import { appPath, type JourneyApp } from '../routes';
import { AppNavigationIcon } from './AppNavigationIcon';
import { APP_NAV_ITEMS } from './appNavigation';
import './journey.css';

export interface AppLauncherProps {
  currentApp: JourneyApp;
}

export function AppLauncher({ currentApp }: AppLauncherProps) {
  return (
    <nav className="journey-launcher" aria-label="ISF 앱">
      <ul className="journey-launcher__list">
        {APP_NAV_ITEMS.map((item) => {
          const isCurrent = item.id === currentApp;
          const accessibleName = [
            item.accessibleLabel,
            isCurrent ? '현재 위치' : null,
            item.availability === 'readiness' ? '준비 중' : null,
          ].filter(Boolean).join(', ');

          return (
            <li key={item.id} className="journey-launcher__item">
              <a
                className="journey-launcher__app-link"
                href={appPath(item.id)}
                aria-label={accessibleName}
                aria-current={isCurrent ? 'page' : undefined}
              >
                <AppNavigationIcon app={item.id} />
                {item.availability === 'readiness' ? (
                  <span className="journey-launcher__readiness-dot" aria-hidden="true" />
                ) : null}
                <span className="journey-launcher__current-line" aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
