export interface JourneyEntryCardProps {
  enabled: boolean;
  onContinue(): void;
}

export function JourneyEntryCard({ enabled, onContinue }: JourneyEntryCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-sm" aria-labelledby="journey-entry-title">
      <p className="m-0 text-sm font-black tracking-wide text-accent">다음 단계</p>
      <h2 className="m-0 mt-2 text-xl font-bold text-slate-950" id="journey-entry-title">Simulation으로 계획 이어가기</h2>
      <p className="mb-0 mt-2 text-sm text-slate-600">{enabled ? '현재 Main 계획을 Simulation에서 이어서 확인할 수 있어요.' : 'Main 계획을 먼저 입력해 주세요.'}</p>
      <button className="journey-action ui-button ui-button--primary mt-4" type="button" disabled={!enabled} onClick={onContinue}>
        Simulation으로 이어가기
      </button>
    </section>
  );
}
