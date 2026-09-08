import { useEffect, useRef, useState, type JSX } from 'react';
import { AccountMapApp, type AccountMapRepositories } from '../../account-map/ui/AccountMapApp';
import type { MainPlanEditTarget } from '../../account-map/ui/setup/AccountMapBasisStep';
import { BrowserMainRepository, type MainRepository } from '../../main/infrastructure/mainRepository';
import { MainPlanEditOverlay, type MainPlanOverlayCloseResult } from './MainPlanEditOverlay';

const browserMainRepository = new BrowserMainRepository();

export interface AccountMapJourneyProps {
  repositories?: AccountMapRepositories;
  mainRepository?: MainRepository;
  mainAvailable?: boolean;
}

interface EditRequest {
  target: MainPlanEditTarget;
  invoker: HTMLElement | null;
}

/** Journey host for Main editing from Account Map. It owns only overlay UI state. */
export function AccountMapJourney({
  repositories,
  mainRepository = browserMainRepository,
  mainAvailable = true,
}: AccountMapJourneyProps = {}): JSX.Element {
  const [request, setRequest] = useState<EditRequest | null>(null);
  const [backgroundBlocked, setBackgroundBlocked] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const backgroundRef = useRef<HTMLDivElement>(null);

  function requestMainEdit(target: MainPlanEditTarget): void {
    if (request !== null) return;
    const active = document.activeElement;
    setRequest({ target, invoker: active instanceof HTMLElement ? active : null });
  }

  function restoreBackground(): void {
    backgroundRef.current?.removeAttribute('inert');
    backgroundRef.current?.removeAttribute('aria-hidden');
    setBackgroundBlocked(false);
  }

  function closeOverlay(result: MainPlanOverlayCloseResult): void {
    restoreBackground();
    setRequest(null);
    if (result.status === 'saved') setRefreshSignal((value) => value + 1);
  }

  useEffect(() => {
    if (mainAvailable) return;
    restoreBackground();
    setRequest(null);
    setRefreshSignal((value) => value + 1);
  }, [mainAvailable]);

  return (
    <>
      <div
        ref={backgroundRef}
        data-testid="account-map-journey-background"
        aria-hidden={backgroundBlocked ? 'true' : undefined}
        inert={backgroundBlocked || undefined}
      >
        <AccountMapApp
          repositories={repositories}
          refreshSignal={refreshSignal}
          onRequestMainEdit={requestMainEdit}
        />
      </div>
      {request === null ? null : (
        <MainPlanEditOverlay
          repository={mainRepository}
          target={request.target}
          returnFocusElement={request.invoker}
          onActivated={() => setBackgroundBlocked(true)}
          onBeforeFocusRestore={restoreBackground}
          onClosed={closeOverlay}
        />
      )}
    </>
  );
}
