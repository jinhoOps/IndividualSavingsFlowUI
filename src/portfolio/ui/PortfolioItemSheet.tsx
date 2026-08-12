import { useRef, useState, type RefObject } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { normalizePortfolioName, recommendClassification } from '../domain/classification';
import type { Classification, ClassificationOrigin } from '../domain/model';
import { formatAllocationPercent } from './format';
import { PortfolioDialog } from './PortfolioDialog';

const QUICK_TARGET_NAMES = ['S&P 500', '나스닥', '코스피', '미국 국채', '금 현물'] as const;

export interface PortfolioItemSheetValue {
  name: string;
  amountWon: number;
  classification: Classification;
  classificationOrigin: ClassificationOrigin;
}

export interface PortfolioItemSheetProps {
  mode: 'add' | 'edit';
  initialValue: PortfolioItemSheetValue;
  existingNames: string[];
  investmentWon: number;
  returnFocusRef: RefObject<HTMLElement | null>;
  onComplete(value: PortfolioItemSheetValue): void;
  onRemove?(): void;
  onClose(): void;
}

export function PortfolioItemSheet({
  mode,
  initialValue,
  existingNames,
  investmentWon,
  returnFocusRef,
  onComplete,
  onRemove,
  onClose,
}: PortfolioItemSheetProps) {
  const [name, setName] = useState(initialValue.name);
  const [amount, setAmount] = useState(initialValue.amountWon > 0 ? String(initialValue.amountWon) : '');
  const [classification, setClassification] = useState(initialValue.classification);
  const [classificationOrigin, setClassificationOrigin] = useState(initialValue.classificationOrigin);
  const [nameTouched, setNameTouched] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const amountWon = amount.trim() === '' ? 0 : Number(amount);
  const normalizedName = normalizePortfolioName(name);
  const duplicateName = normalizedName.length > 0
    && existingNames.some((candidate) => normalizePortfolioName(candidate) === normalizedName);
  const nameError = normalizedName.length === 0
    ? '투자 대상 이름을 입력해 주세요.'
    : duplicateName ? '같은 이름의 투자 대상이 이미 있습니다.' : null;
  const amountError = !Number.isInteger(amountWon) || amountWon < 1_000
    ? '투자 대상 금액은 1,000원 이상이어야 합니다.'
    : amountWon > investmentWon ? '월 투자금을 초과할 수 없습니다.' : null;
  const dirty = name !== initialValue.name
    || amountWon !== initialValue.amountWon
    || classification !== initialValue.classification
    || classificationOrigin !== initialValue.classificationOrigin;
  const title = mode === 'add' ? '투자 대상 추가' : '투자 대상 수정';

  function requestClose(): void {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  function updateName(nextName: string): void {
    setNameTouched(true);
    setName(nextName);
    if (classificationOrigin === 'automatic') {
      setClassification(recommendClassification(nextName));
    }
  }

  function quickFillName(nextName: string): void {
    updateName(nextName);
    amountInputRef.current?.focus();
  }

  return (
    <>
      <PortfolioDialog
        labelledBy="portfolio-item-sheet-title"
        onClose={requestClose}
        returnFocusRef={returnFocusRef}
        className="portfolio-item-sheet"
        dataPresentation="sheet"
        closeOnBackdrop
      >
        <header className="portfolio-item-sheet__header">
          <h2 id="portfolio-item-sheet-title">{title}</h2>
          {mode === 'edit' && onRemove ? (
            <button type="button" className="portfolio-item-sheet__remove" aria-label="투자 대상 삭제" onClick={onRemove}>
              <Trash2 aria-hidden="true" size={20} strokeWidth={2} />
            </button>
          ) : null}
        </header>
        <div className="portfolio-item-sheet__fields">
          <div className="portfolio-item-sheet__identity">
            <label>
              <span>투자 대상 이름</span>
              <input
                ref={nameInputRef}
                data-dialog-initial-focus
                aria-label="투자 대상 이름"
                aria-invalid={nameTouched && nameError ? 'true' : undefined}
                aria-describedby={nameTouched && nameError ? 'portfolio-item-name-error' : undefined}
                value={name}
                onChange={(event) => updateName(event.target.value)}
              />
              {nameTouched && nameError ? <span className="portfolio-editor__field-error" id="portfolio-item-name-error">{nameError}</span> : null}
            </label>
            <button
              type="button"
              className="portfolio-editor__classification-toggle"
              aria-label={`${classification === 'growth' ? '성장' : '안정'}, 누르면 ${classification === 'growth' ? '안정' : '성장'}으로 변경`}
              onClick={() => {
                setClassification((current) => current === 'growth' ? 'stable' : 'growth');
                setClassificationOrigin('user');
              }}
            >{classification === 'growth' ? '성장' : '안정'}</button>
          </div>
          {mode === 'add' ? (
            <div className="portfolio-item-sheet__quick-targets" role="group" aria-label="대표 투자 대상">
              {QUICK_TARGET_NAMES.map((quickName) => (
                <button
                  key={quickName}
                  type="button"
                  className="portfolio-item-sheet__quick-target"
                  onClick={() => quickFillName(quickName)}
                >{quickName}</button>
              ))}
            </div>
          ) : null}
          <label className="portfolio-item-sheet__amount">
            <span>금액</span>
            <input
              ref={amountInputRef}
              inputMode="numeric"
              aria-label="금액"
              aria-invalid={amountTouched && amountError ? 'true' : undefined}
              aria-describedby={amountTouched && amountError ? 'portfolio-item-amount-error' : amountError ? undefined : 'portfolio-item-calculated-percentage'}
              value={amount}
              onChange={(event) => {
                setAmountTouched(true);
                setAmount(event.target.value);
              }}
            />
            {amountTouched && amountError ? (
              <span className="portfolio-editor__field-error" id="portfolio-item-amount-error">{amountError}</span>
            ) : amountError === null ? (
              <span className="portfolio-item-sheet__calculated" id="portfolio-item-calculated-percentage">
                계산 비율 {formatAllocationPercent(investmentWon > 0 ? amountWon / investmentWon * 100 : 0)}
              </span>
            ) : null}
          </label>
        </div>
        <footer className="portfolio-item-sheet__actions">
          <Button type="button" variant="secondary" onClick={requestClose}>취소</Button>
          <Button
            type="button"
            variant="primary"
            disabled={nameError !== null || amountError !== null}
            onClick={() => onComplete({ name: name.trim(), amountWon, classification, classificationOrigin })}
          >완료</Button>
        </footer>
      </PortfolioDialog>
      {confirmDiscard ? (
        <PortfolioDialog
          labelledBy="portfolio-item-discard-title"
          onClose={() => setConfirmDiscard(false)}
          returnFocusRef={nameInputRef}
        >
          <h2 id="portfolio-item-discard-title">입력 내용을 버릴까요?</h2>
          <p>완료하지 않은 변경 내용이 사라집니다.</p>
          <div className="portfolio-item-sheet__discard-actions">
            <Button type="button" variant="secondary" data-dialog-initial-focus onClick={() => setConfirmDiscard(false)}>계속 입력</Button>
            <Button type="button" variant="primary" onClick={onClose}>버리기</Button>
          </div>
        </PortfolioDialog>
      ) : null}
    </>
  );
}
