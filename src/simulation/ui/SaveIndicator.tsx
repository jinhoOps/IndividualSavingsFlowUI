import { useDelayedPending } from '../../components/feedback/useDelayedPending';

export type SimulationSaveState = 'saving' | 'saved' | 'error';

export function SaveIndicator({ state }: { state: SimulationSaveState }) {
  const delayedSaving = useDelayedPending(state === 'saving', 600);

  if (state === 'error') {
    return (
      <p className="simulation-save-indicator" data-state={state} role="alert">
        <span aria-hidden="true" />
        자동 저장하지 못했어요
      </p>
    );
  }
  if (!delayedSaving) return null;

  return (
    <p className="simulation-save-indicator" data-state={state} role="status">
      <span aria-hidden="true" />
      저장 중
    </p>
  );
}
