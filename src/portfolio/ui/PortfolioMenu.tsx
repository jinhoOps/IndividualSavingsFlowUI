import { useRef, useState } from 'react';

export function PortfolioMenu({ onReset }: { onReset: () => void }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  function close(): void {
    triggerRef.current?.focus();
    setOpen(false);
  }
  return (
    <div className="portfolio-menu">
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>처음부터 다시</button>
      {open ? (
        <div role="dialog" aria-modal="true" aria-labelledby="portfolio-reset-title" className="portfolio-dialog">
          <h2 id="portfolio-reset-title">투자 배분을 초기화할까요?</h2>
          <p>투자 대상이 제거되고 투자금 전체가 현금으로 돌아갑니다.</p>
          <button type="button" onClick={close}>취소</button>
          <button type="button" onClick={() => { onReset(); setOpen(false); }}>초기화</button>
        </div>
      ) : null}
    </div>
  );
}
