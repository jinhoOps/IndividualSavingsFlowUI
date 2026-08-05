import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { appPath, type JourneyApp } from '../routes';
import { AppNavigationIcon } from './AppNavigationIcon';
import { APP_NAV_ITEMS } from './appNavigation';
import './journey.css';

export interface AppLauncherProps {
  currentApp: JourneyApp;
}

const LONG_PRESS_MS = 450;
const HELP_PANEL_ID = 'journey-app-icon-help';

export function AppLauncher({ currentApp }: AppLauncherProps) {
  const launcherRef = useRef<HTMLElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickRef = useRef(false);
  const suppressContextMenuRef = useRef(false);
  const [activeTooltip, setActiveTooltip] = useState<JourneyApp | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const cancelLongPress = () => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => cancelLongPress, []);

  useEffect(() => {
    if (!helpOpen) return;

    const closeOutside = (event: PointerEvent) => {
      if (!launcherRef.current?.contains(event.target as Node)) setHelpOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [helpOpen]);

  const startLongPress = (event: ReactPointerEvent<HTMLAnchorElement>, app: JourneyApp) => {
    if (event.pointerType !== 'touch') return;
    cancelLongPress();
    longPressTimerRef.current = setTimeout(() => {
      setActiveTooltip(app);
      suppressClickRef.current = true;
      suppressContextMenuRef.current = true;
      longPressTimerRef.current = null;
    }, LONG_PRESS_MS);
  };

  const closeAll = () => {
    cancelLongPress();
    setActiveTooltip(null);
    setHelpOpen(false);
  };

  return (
    <nav
      ref={launcherRef}
      className="journey-launcher"
      aria-label="ISF 앱"
      onKeyDown={(event) => {
        if (event.key === 'Escape') closeAll();
      }}
    >
      <ul className="journey-launcher__list">
        {APP_NAV_ITEMS.map((item) => {
          const isCurrent = item.id === currentApp;
          const tooltipId = `journey-app-tooltip-${item.id}`;
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
                aria-describedby={activeTooltip === item.id ? tooltipId : undefined}
                onMouseEnter={() => setActiveTooltip(item.id)}
                onMouseLeave={() => setActiveTooltip((active) => active === item.id ? null : active)}
                onFocus={() => setActiveTooltip(item.id)}
                onBlur={() => setActiveTooltip((active) => active === item.id ? null : active)}
                onPointerDown={(event) => startLongPress(event, item.id)}
                onPointerUp={cancelLongPress}
                onPointerMove={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onClick={(event) => {
                  if (!suppressClickRef.current) return;
                  event.preventDefault();
                  suppressClickRef.current = false;
                }}
                onContextMenu={(event) => {
                  if (!suppressContextMenuRef.current) return;
                  event.preventDefault();
                  suppressContextMenuRef.current = false;
                }}
              >
                <AppNavigationIcon app={item.id} />
                {item.availability === 'readiness' ? (
                  <span className="journey-launcher__readiness-dot" aria-hidden="true" />
                ) : null}
                <span className="journey-launcher__current-line" aria-hidden="true" />
              </a>
              {activeTooltip === item.id ? (
                <span id={tooltipId} role="tooltip" className="journey-launcher__tooltip">
                  {item.accessibleLabel}
                </span>
              ) : null}
            </li>
          );
        })}
        <li className="journey-launcher__help-item">
          <button
            type="button"
            className="journey-launcher__help-hit"
            aria-label="앱 아이콘 도움말"
            aria-expanded={helpOpen}
            aria-controls={HELP_PANEL_ID}
            onClick={() => {
              setActiveTooltip(null);
              setHelpOpen((open) => !open);
            }}
          >
            <span className="journey-launcher__help-visual" data-help-visual aria-hidden="true">?</span>
          </button>
          {helpOpen ? (
            <section
              id={HELP_PANEL_ID}
              className="journey-launcher__help-panel"
              role="region"
              aria-label="앱 아이콘 안내"
            >
              <ul>
                {APP_NAV_ITEMS.map((item) => (
                  <li key={item.id}>
                    <AppNavigationIcon app={item.id} />
                    <span>{item.accessibleLabel}</span>
                    {item.availability === 'readiness' ? <small>준비 중</small> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </li>
      </ul>
    </nav>
  );
}
