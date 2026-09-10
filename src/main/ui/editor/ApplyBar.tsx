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
      className="main-apply-bar"
      aria-busy={saving ? 'true' : undefined}
      aria-label="변경 적용"
    >
      <p
        className={`main-apply-bar__status${failed ? ' main-apply-bar__status--error' : ''}`}
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
      <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>취소</Button>
      <Button type="button" variant="primary" disabled={!dirty || saving} onClick={onApply}>
        {delayedSaving ? '저장 중' : failed ? '다시 시도' : '적용'}
      </Button>
    </footer>
  );
}
