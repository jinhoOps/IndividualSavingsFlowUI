import { useEffect, useRef, useState } from 'react';

export function SimulationMenu({
  onReset,
  resetFailed,
}: {
  onReset(): void;
  resetFailed: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  function closeConfirmation(): void {
    setConfirming(false);
    openerRef.current?.focus();
  }

  useEffect(() => {
    if (!confirming) return undefined;
    cancelRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeConfirmation();
      }
      if (event.key === 'Tab') {
        const controls = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>('button') ?? [],
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (first === undefined || last === undefined) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [confirming]);

  return (
    <details className="simulation-menu">
      <summary>Simulation 메뉴</summary>
      <button ref={openerRef} type="button" onClick={() => setConfirming(true)}>
        시뮬레이션 다시 설정
      </button>
      {confirming ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="simulation-reset-title"
        >
          <h2 id="simulation-reset-title">시뮬레이션 다시 설정</h2>
          <p>Simulation에서 설정한 값만 지우고 다시 시작합니다.</p>
          <button ref={cancelRef} type="button" onClick={closeConfirmation}>취소</button>
          <button
            type="button"
            onClick={() => {
              onReset();
              setConfirming(false);
            }}
          >
            다시 설정 확인
          </button>
        </div>
      ) : null}
      {resetFailed ? <p role="alert">시뮬레이션을 다시 설정하지 못했어요.</p> : null}
    </details>
  );
}
