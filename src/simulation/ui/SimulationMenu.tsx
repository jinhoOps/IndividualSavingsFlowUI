import { useState } from 'react';

export function SimulationMenu({
  onReset,
  resetFailed,
}: {
  onReset(): void;
  resetFailed: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <details className="simulation-menu">
      <summary>Simulation 메뉴</summary>
      <button type="button" onClick={() => setConfirming(true)}>
        시뮬레이션 다시 설정
      </button>
      {confirming ? (
        <div role="dialog" aria-labelledby="simulation-reset-title">
          <h2 id="simulation-reset-title">시뮬레이션 다시 설정</h2>
          <p>Simulation에서 설정한 값만 지우고 다시 시작합니다.</p>
          <button type="button" onClick={() => setConfirming(false)}>취소</button>
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
