export type SimulationSaveState = 'saving' | 'saved' | 'error';

const labels: Record<SimulationSaveState, string> = {
  saving: '저장 중',
  saved: '저장됨',
  error: '자동 저장하지 못했어요',
};

export function SaveIndicator({ state }: { state: SimulationSaveState }) {
  return (
    <p className="simulation-save-indicator" data-state={state} role="status">
      <span aria-hidden="true" />
      {labels[state]}
    </p>
  );
}
