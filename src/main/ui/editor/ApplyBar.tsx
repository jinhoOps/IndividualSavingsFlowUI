import type { MainState } from '../../application/mainReducer';
import { useDelayedPending } from '../../../components/feedback/useDelayedPending';
import { Button } from '../common/Button';

export interface ApplyBarProps {
  dirty: boolean;
  saveStatus: MainState['saveStatus'];
  onApply(): void;
  onCancel(): void;
}

export function ApplyBar({ dirty, saveStatus, onApply, onCancel }: ApplyBarProps) {
  const saving = saveStatus === 'saving';
  const delayedSaving = useDelayedPending(saving, 600);
  const failed = saveStatus === 'error';
  return (
    <footer
      className="sticky bottom-0 z-20 grid gap-3 border-t border-slate-200 bg-white/96 p-4 shadow-[0_-12px_32px_rgba(15,23,42,0.08)] backdrop-blur sm:grid-cols-[1fr_auto_auto] sm:items-center"
      aria-busy={saving ? 'true' : undefined}
      aria-label="변경 적용"
    >
      <p
        className={`m-0 text-sm font-bold ${failed ? 'text-rose-700' : 'text-slate-600'}`}
        aria-live={failed ? undefined : 'polite'}
        role={failed ? 'alert' : undefined}
      >
        {delayedSaving
          ? '저장 중입니다.'
          : failed
            ? '저장하지 못했습니다. 초안은 그대로 보존되어 있습니다.'
            : dirty
              ? '저장하지 않은 변경사항이 있습니다.'
              : '저장된 계획과 동일합니다.'}
      </p>
      <Button className="py-2.5" type="button" variant="secondary" disabled={saving} onClick={onCancel}>취소</Button>
      <Button className="px-5 py-2.5" type="button" variant="primary" disabled={!dirty || saving} onClick={onApply}>
        {delayedSaving ? '저장 중' : failed ? '다시 시도' : '적용'}
      </Button>
    </footer>
  );
}
