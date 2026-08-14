import { useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { appPath, type JourneyApp } from '../routes';
import { AppNavigationIcon } from './AppNavigationIcon';
import { APP_NAV_ITEMS } from './appNavigation';
import { partitionAppNavigation } from './appNavigationOverflow';
import './journey.css';

export interface AppLauncherProps {
  currentApp: JourneyApp;
  managementMenu?: ReactNode;
}

const LONG_PRESS_MS = 450;
const TOOLTIP_CLOSE_MS = 80;
const SUPPRESSION_TTL_MS = 1_500;

interface TouchSuppression {
  app: JourneyApp;
  click: boolean;
  contextMenu: boolean;
}

export function AppLauncher({ currentApp, managementMenu }: AppLauncherProps) {
  const navigationRef = useRef<HTMLElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const overflowRootRef = useRef<HTMLLIElement>(null);
  const overflowTriggerRef = useRef<HTMLButtonElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTouchPointersRef = useRef(new Set<number>());
  const multitouchBlockedRef = useRef(false);
  const touchSuppressionRef = useRef<TouchSuppression | null>(null);
  const pendingResizeFocusRef = useRef<JourneyApp | 'overflow-trigger' | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<JourneyApp | null>(null);
  const [availableWidth, setAvailableWidth] = useState<number>();
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowId = useId();
  const { visible, overflow } = partitionAppNavigation(
    APP_NAV_ITEMS,
    currentApp,
    availableWidth,
  );

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
    const navigation = navigationRef.current;
    if (navigation === null || typeof ResizeObserver === 'undefined') return undefined;
    const updateWidth = () => {
      const nextWidth = navigation.clientWidth;
      const nextPartition = partitionAppNavigation(APP_NAV_ITEMS, currentApp, nextWidth);
      const active = document.activeElement;
      const activeApp = active instanceof HTMLElement
        ? active.dataset.journeyApp as JourneyApp | undefined
        : undefined;
      if (
        activeApp !== undefined
        && overflowRootRef.current?.contains(active)
        && nextPartition.visible.some(({ id }) => id === activeApp)
      ) {
        pendingResizeFocusRef.current = activeApp;
      } else if (
        activeApp !== undefined
        && navigation.contains(active)
        && !nextPartition.visible.some(({ id }) => id === activeApp)
      ) {
        pendingResizeFocusRef.current = 'overflow-trigger';
      } else if (active === overflowTriggerRef.current && nextPartition.overflow.length === 0) {
        pendingResizeFocusRef.current = currentApp;
      }
      setAvailableWidth(nextWidth);
    };
    const observer = new ResizeObserver(updateWidth);
    updateWidth();
    observer.observe(navigation);
    return () => observer.disconnect();
  }, [currentApp]);

  useLayoutEffect(() => {
    const app = pendingResizeFocusRef.current;
    if (app === null) return;
    pendingResizeFocusRef.current = null;
    if (app === 'overflow-trigger') {
      overflowTriggerRef.current?.focus();
      return;
    }
    navigationRef.current
      ?.querySelector<HTMLElement>(`[data-journey-app="${app}"]`)
      ?.focus();
  }, [availableWidth]);

  useEffect(() => {
    if (!overflowOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOverflowOpen(false);
      overflowTriggerRef.current?.focus();
    };
    const closeOutside = (event: PointerEvent) => {
      if (!overflowRootRef.current?.contains(event.target as Node)) {
        setOverflowOpen(false);
        const target = event.target as Node;
        const movingWithinLauncher = navigationRef.current?.contains(target)
          || toolsRef.current?.contains(target);
        if (!movingWithinLauncher) {
          window.setTimeout(() => overflowTriggerRef.current?.focus(), 0);
        }
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOutside);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOutside);
    };
  }, [overflowOpen]);

  useEffect(() => {
    if (overflow.length === 0) setOverflowOpen(false);
  }, [overflow.length]);

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
    setOverflowOpen(false);
  };

  return (
    <div className="journey-launcher">
      <nav
        ref={navigationRef}
        className="journey-launcher__navigation"
        aria-label="ISF 앱"
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          if (overflowOpen) {
            event.preventDefault();
            setOverflowOpen(false);
            overflowTriggerRef.current?.focus();
          } else {
            if (activeTooltip !== null) event.preventDefault();
            closeAll();
          }
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setOverflowOpen(false);
          }
        }}
      >
        <ul className="journey-launcher__list">
          {visible.map((item) => {
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
                  data-journey-app={item.id}
                  href={appPath(item.id)}
                  aria-label={accessibleName}
                  aria-current={isCurrent ? 'page' : undefined}
                  aria-describedby={activeTooltip === item.id ? tooltipId : undefined}
                  onMouseEnter={() => {
                    setOverflowOpen(false);
                    openTooltip(item.id);
                  }}
                  onMouseLeave={() => scheduleTooltipClose(item.id)}
                  onFocus={() => {
                    setOverflowOpen(false);
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
          {overflow.length === 0 ? null : (
            <li ref={overflowRootRef} className="journey-launcher__overflow-item">
              <button
                ref={overflowTriggerRef}
                type="button"
                className="journey-launcher__overflow-trigger"
                aria-label="앱 더보기"
                aria-expanded={overflowOpen}
                aria-controls={overflowId}
                onClick={() => {
                  setActiveTooltip(null);
                  setOverflowOpen((open) => !open);
                }}
              >
                <MoreIcon />
              </button>
              {overflowOpen ? (
                <div id={overflowId} className="journey-launcher__overflow-menu" role="region" aria-label="추가 앱">
                  {overflow.map((item) => {
                    const accessibleName = [
                      item.accessibleLabel,
                      item.availability === 'readiness' ? '준비 중' : null,
                    ].filter(Boolean).join(', ');
                    return (
                      <a
                        key={item.id}
                        className="journey-launcher__overflow-link"
                        data-journey-app={item.id}
                        href={appPath(item.id)}
                        aria-label={accessibleName}
                      >
                        <AppNavigationIcon app={item.id} />
                        <span>{item.accessibleLabel}</span>
                        {item.availability === 'readiness' ? <small>준비 중</small> : null}
                      </a>
                    );
                  })}
                </div>
              ) : null}
            </li>
          )}
        </ul>
      </nav>
      <div
        ref={toolsRef}
        className="journey-launcher__tools"
        role="group"
        aria-label="앱 도구"
        onPointerDown={closeAll}
        onFocusCapture={() => {
          if (tooltipCloseTimerRef.current !== null) clearTimeout(tooltipCloseTimerRef.current);
          tooltipCloseTimerRef.current = null;
          setActiveTooltip(null);
          setOverflowOpen(false);
        }}
      >
        {managementMenu}
      </div>
    </div>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
