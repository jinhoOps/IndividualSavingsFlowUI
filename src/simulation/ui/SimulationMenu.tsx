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
  const dialogRef = useRef<HTMLDialogElement>(null);

  function closeConfirmation(): void {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
    setConfirming(false);
    openerRef.current?.focus();
  }

  useEffect(() => {
    if (!confirming) return undefined;
    const dialog = dialogRef.current;
    if (dialog !== null && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    cancelRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeConfirmation();
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
        <dialog
          ref={dialogRef}
          aria-modal="true"
          aria-labelledby="simulation-reset-title"
          onCancel={(event) => {
            event.preventDefault();
            closeConfirmation();
          }}
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
        </dialog>
      ) : null}
      {resetFailed ? <p role="alert">시뮬레이션을 다시 설정하지 못했어요.</p> : null}
    </details>
  );
}
