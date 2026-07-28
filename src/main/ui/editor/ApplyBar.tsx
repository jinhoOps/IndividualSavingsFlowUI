export interface ApplyBarProps {
  dirty: boolean;
  saving: boolean;
  onApply(): void;
  onCancel(): void;
}

export function ApplyBar({ dirty, saving, onApply, onCancel }: ApplyBarProps) {
  return (
    <footer aria-label="변경 적용">
      <p aria-live="polite">{saving ? '저장 중입니다.' : dirty ? '저장하지 않은 변경사항이 있습니다.' : '저장된 계획과 동일합니다.'}</p>
      <button type="button" disabled={saving} onClick={onCancel}>취소</button>
      <button type="button" disabled={!dirty || saving} onClick={onApply}>
        {saving ? '저장 중' : '적용'}
      </button>
    </footer>
  );
}
