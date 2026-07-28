export interface ApplyBarProps {
  dirty: boolean;
  saving: boolean;
  onApply(): void;
  onCancel(): void;
}

export function ApplyBar({ dirty, saving, onApply, onCancel }: ApplyBarProps) {
  return (
    <footer className="sticky bottom-0 z-20 grid gap-3 border-t border-slate-200 bg-white/96 p-4 shadow-[0_-12px_32px_rgba(15,23,42,0.08)] backdrop-blur sm:grid-cols-[1fr_auto_auto] sm:items-center" aria-label="변경 적용">
      <p className="m-0 text-sm font-bold text-slate-600" aria-live="polite">{saving ? '저장 중입니다.' : dirty ? '저장하지 않은 변경사항이 있습니다.' : '저장된 계획과 동일합니다.'}</p>
      <button className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={saving} onClick={onCancel}>취소</button>
      <button className="rounded-xl bg-slate-950 px-5 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40" type="button" disabled={!dirty || saving} onClick={onApply}>
        {saving ? '저장 중' : '적용'}
      </button>
    </footer>
  );
}
