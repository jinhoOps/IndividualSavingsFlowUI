import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { appPath, type JourneyApp } from '../routes';
import { AppNavigationIcon } from './AppNavigationIcon';
import { APP_NAV_ITEMS } from './appNavigation';
import './journey.css';

export interface AppLauncherProps {
  currentApp: JourneyApp;
}

const LONG_PRESS_MS = 450;
const TOOLTIP_CLOSE_MS = 80;
const SUPPRESSION_TTL_MS = 1_500;
const HELP_PANEL_ID = 'journey-app-icon-help';

interface TouchSuppression {
  app: JourneyApp;
  click: boolean;
  contextMenu: boolean;
}

export function AppLauncher({ currentApp }: AppLauncherProps) {
  const launcherRef = useRef<HTMLElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTouchPointersRef = useRef(new Set<number>());
  const multitouchBlockedRef = useRef(false);
  const touchSuppressionRef = useRef<TouchSuppression | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<JourneyApp | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const cancelLongPress = () => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const clearSuppression = () => {
    if (suppressionTimerRef.current !== null) clearTimeout(suppressionTimerRef.current);
    suppressionTimerRef.current = null;
    touchSuppressionRef.current = null;
  };

  const openTooltip = (app: JourneyApp) => {
    if (tooltipCloseTimerRef.current !== null) clearTimeout(tooltipCloseTimerRef.current);
    tooltipCloseTimerRef.current = null;
    setActiveTooltip(app);
  };

  const scheduleTooltipClose = (app: JourneyApp) => {
    if (tooltipCloseTimerRef.current !== null) clearTimeout(tooltipCloseTimerRef.current);
    tooltipCloseTimerRef.current = setTimeout(() => {
      setActiveTooltip((active) => active === app ? null : active);
      tooltipCloseTimerRef.current = null;
    }, TOOLTIP_CLOSE_MS);
  };

  useEffect(() => () => {
    cancelLongPress();
    clearSuppression();
    if (tooltipCloseTimerRef.current !== null) clearTimeout(tooltipCloseTimerRef.current);
  }, []);

  useEffect(() => {
    if (!helpOpen) return;

    const closeOutside = (event: PointerEvent) => {
      if (!launcherRef.current?.contains(event.target as Node)) setHelpOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [helpOpen]);

  const startLongPress = (event: ReactPointerEvent<HTMLAnchorElement>, app: JourneyApp) => {
    if (event.pointerType !== 'touch') {
      clearSuppression();
      return;
    }
    if (activeTouchPointersRef.current.size === 0) clearSuppression();
    activeTouchPointersRef.current.add(event.pointerId);
    if (activeTouchPointersRef.current.size > 1) {
      cancelLongPress();
      multitouchBlockedRef.current = true;
      return;
    }
    if (multitouchBlockedRef.current) return;
    cancelLongPress();
    longPressTimerRef.current = setTimeout(() => {
      openTooltip(app);
      clearSuppression();
      touchSuppressionRef.current = { app, click: true, contextMenu: true };
      suppressionTimerRef.current = setTimeout(clearSuppression, SUPPRESSION_TTL_MS);
      longPressTimerRef.current = null;
    }, LONG_PRESS_MS);
  };

  const finishTouch = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType !== 'touch') return;
    cancelLongPress();
    activeTouchPointersRef.current.delete(event.pointerId);
    if (activeTouchPointersRef.current.size === 0) multitouchBlockedRef.current = false;
  };

  const cancelTouchGesture = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType !== 'touch') return;
    cancelLongPress();
    if (event.type === 'pointercancel') {
      activeTouchPointersRef.current.delete(event.pointerId);
      if (activeTouchPointersRef.current.size === 0) multitouchBlockedRef.current = false;
    }
  };

  const consumeSuppression = (app: JourneyApp, kind: 'click' | 'contextMenu') => {
    const suppression = touchSuppressionRef.current;
    if (suppression?.app !== app || !suppression[kind]) return false;
    suppression[kind] = false;
    if (!suppression.click && !suppression.contextMenu) clearSuppression();
    return true;
  };

  const closeAll = () => {
    cancelLongPress();
    if (tooltipCloseTimerRef.current !== null) clearTimeout(tooltipCloseTimerRef.current);
    tooltipCloseTimerRef.current = null;
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
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHelpOpen(false);
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
                onMouseEnter={() => openTooltip(item.id)}
                onMouseLeave={() => scheduleTooltipClose(item.id)}
                onFocus={() => {
                  setHelpOpen(false);
                  openTooltip(item.id);
                }}
                onBlur={() => scheduleTooltipClose(item.id)}
                onPointerDown={(event) => startLongPress(event, item.id)}
                onPointerUp={finishTouch}
                onPointerMove={cancelTouchGesture}
                onPointerCancel={cancelTouchGesture}
                onClick={(event) => {
                  if (!consumeSuppression(item.id, 'click')) return;
                  event.preventDefault();
                }}
                onContextMenu={(event) => {
                  if (!consumeSuppression(item.id, 'contextMenu')) return;
                  event.preventDefault();
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
