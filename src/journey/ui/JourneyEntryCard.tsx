import { Button } from '../../components/common/Button';

export interface JourneyEntryCardProps {
  enabled: boolean;
  onContinue(): void;
}

export function JourneyEntryCard({ enabled, onContinue }: JourneyEntryCardProps) {
  return (
    <section className="main-journey-entry" aria-labelledby="journey-entry-title">
      <p className="m-0 text-sm font-black tracking-wide text-accent">다음 단계</p>
      <h2 className="m-0 mt-2 text-xl font-bold text-slate-950" id="journey-entry-title">Simulation으로 계획 이어가기</h2>
      <p className="mb-0 mt-2 text-sm text-slate-600">{enabled ? '저축·투자로 미래 자산을 확인해요.' : 'Main 계획을 먼저 입력해 주세요.'}</p>
      <Button variant="primary" className="journey-action mt-4" type="button" disabled={!enabled} onClick={onContinue}>
        Simulation으로 이어가기
      </Button>
    </section>
  );
}
