import { useMemo, useState } from 'react';
import {
  createPortfolioJourneySnapshot,
  type JourneySnapshot,
} from '../domain/journeySnapshot';
import {
  BrowserJourneyRepository,
  type JourneyLoadResult,
  type JourneyRepository,
} from '../infrastructure/journeyRepository';
import { appPath } from '../routes';
import { AppLauncher } from './AppLauncher';

export type ReadinessDestination = 'simulation' | 'portfolio' | 'account-map';

export interface ReadinessAppProps {
  destination: ReadinessDestination;
  repository?: JourneyRepository;
  now?: () => number;
  navigate?: (path: string) => void;
}

type ConnectionState =
  | { kind: 'connected'; snapshot: JourneySnapshot }
  | { kind: 'empty' }
  | { kind: 'invalid' };

const appLabels: Record<ReadinessDestination, string> = {
  simulation: 'Simulation',
  portfolio: 'Portfolio',
  'account-map': 'Account Map',
};

export function ReadinessApp({
  destination,
  repository: providedRepository,
  now = Date.now,
  navigate = navigateTo,
}: ReadinessAppProps) {
  const repository = useMemo(
    () => providedRepository ?? new BrowserJourneyRepository(),
    [providedRepository],
  );
  const connection = useMemo(
    () => destination === 'account-map'
      ? null
      : loadConnection(destination, repository.load(destination)),
    [destination, repository],
  );
  const [handoffError, setHandoffError] = useState(false);

  const title = `${appLabels[destination]} 준비 중`;
  const connectedSnapshot = connection?.kind === 'connected' ? connection.snapshot : null;

  function continueToPortfolio(): void {
    if (destination !== 'simulation' || connectedSnapshot === null) return;

    try {
      repository.save(createPortfolioJourneySnapshot(connectedSnapshot, now()));
    } catch {
      setHandoffError(true);
      return;
    }

    navigate(appPath('portfolio'));
  }

  return (
    <main className="journey-readiness" aria-labelledby="readiness-title">
      <AppLauncher currentApp={destination} />
      <section className="journey-readiness__content">
        <p>ISF 앱 준비 화면</p>
        <h1 id="readiness-title">{title}</h1>
        {destination === 'account-map' ? (
          <p className="journey-message">Account Map은 Main과 분리된 신규 앱으로 설계될 예정입니다.</p>
        ) : (
          <ConnectionPanel connection={connection!} />
        )}
        {handoffError ? (
          <p className="journey-message journey-message--error" role="alert">
            연결 정보를 저장하지 못했습니다. Main 데이터는 변경되지 않았습니다.
          </p>
        ) : null}
        {destination === 'simulation' && connectedSnapshot !== null ? (
          <button className="journey-action journey-action--primary" type="button" onClick={continueToPortfolio}>
            Portfolio로 이어가기
          </button>
        ) : null}
        <a className="journey-action journey-action--secondary" href={appPath('main')}>
          {connectedSnapshot === null ? 'Main으로 이동' : 'Main에서 최신 정보 가져오기'}
        </a>
      </section>
    </main>
  );
}

function ConnectionPanel({ connection }: { connection: ConnectionState }) {
  if (connection.kind === 'empty') {
    return <p className="journey-message">Main에서 계획을 먼저 완성해 주세요</p>;
  }

  if (connection.kind === 'invalid') {
    return <p className="journey-message journey-message--error">연결 정보를 확인하지 못했습니다</p>;
  }

  return (
    <section className="journey-connection" aria-label="연결된 Main 계획">
      <p className="journey-connection__status" role="status">연결되었습니다</p>
      <p className="journey-connection__amount">
        월 투자 가능액 {formatJourneyWon(connection.snapshot.monthlyInvestableAmountWon)}
      </p>
      <time
        className="journey-connection__time"
        dateTime={new Date(connection.snapshot.mainUpdatedAt).toISOString()}
        lang="ko-KR"
      >
        Main 갱신 {formatMainUpdatedAt(connection.snapshot.mainUpdatedAt)}
      </time>
    </section>
  );
}

function loadConnection(
  destination: Exclude<ReadinessDestination, 'account-map'>,
  result: JourneyLoadResult,
): ConnectionState {
  if (result.status === 'empty') return { kind: 'empty' };
  if (result.status === 'invalid' || result.snapshot.destinationApp !== destination) {
    return { kind: 'invalid' };
  }

  return { kind: 'connected', snapshot: result.snapshot };
}

function formatJourneyWon(amountWon: number): string {
  const absoluteAmountWon = Math.abs(amountWon);
  const sign = amountWon < 0 ? '-' : '';

  if (absoluteAmountWon >= 10_000) {
    const amountInManWon = absoluteAmountWon / 10_000;
    const formattedAmount = Number.isInteger(amountInManWon)
      ? new Intl.NumberFormat('ko-KR').format(amountInManWon)
      : new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(amountInManWon);
    return `${sign}${formattedAmount}만 원`;
  }

  return `${sign}${new Intl.NumberFormat('ko-KR').format(absoluteAmountWon)}원`;
}

function formatMainUpdatedAt(timestamp: number): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

function navigateTo(path: string): void {
  window.location.assign(path);
}
