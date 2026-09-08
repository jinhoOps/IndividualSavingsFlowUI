import { useState, type JSX } from 'react';
import type { FinancialLocation } from '../../../workspace/domain/financialLocation';
import type { AccountFlowCalculation } from '../../domain/accountFlowCalculator';
import type { AccountTransferSuggestion } from '../../domain/accountFlowSuggestion';
import type { AccountMapDraftV2, AccountTransferLink } from '../../domain/model';
import { AccountTransferEditor, type AccountTransferEditorValue } from '../AccountTransferEditor';

export interface AccountMapTransfersStepProps {
  locations: readonly FinancialLocation[];
  draft: AccountMapDraftV2;
  calculation: AccountFlowCalculation;
  suggestions: readonly AccountTransferSuggestion[];
  disabled?: boolean;
  onAddTransfer(value: AccountTransferEditorValue & { id: string }): Promise<AccountMapTransferSaveResult>;
  onEditTransfer(id: string, value: AccountTransferEditorValue): Promise<AccountMapTransferSaveResult>;
  onRemoveTransfer(id: string): Promise<AccountMapTransferSaveResult>;
}

export type AccountMapTransferSaveResult =
  | { status: 'saved' | 'recovery' | 'failed' }
  | { status: 'validation'; message: string };

/** Suggestions are intentionally only UI proposals until this component asks for a normal add-transfer command. */
export function AccountMapTransfersStep({
  locations,
  draft,
  calculation,
  suggestions,
  disabled = false,
  onAddTransfer,
  onEditTransfer,
  onRemoveTransfer,
}: AccountMapTransfersStepProps): JSX.Element {
  const [editor, setEditor] = useState<'add' | string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const activeTransfers = draft.transfers.filter((transfer) => transfer.status === 'active');
  const editing = editor === null || editor === 'add'
    ? undefined
    : draft.transfers.find((transfer) => transfer.id === editor);
  const locationName = (locationId: string): string => locations.find((location) => location.id === locationId)?.shortName ?? '알 수 없는 계좌';

  async function saveNew(value: AccountTransferEditorValue): Promise<boolean> {
    setFeedback(null);
    const result = await onAddTransfer({ ...value, id: `transfer:${createId()}` });
    if (result.status === 'saved') setEditor(null);
    else if (result.status === 'validation') setFeedback(result.message);
    return result.status === 'saved';
  }

  async function saveEdit(value: AccountTransferEditorValue): Promise<boolean> {
    if (editing === undefined) return false;
    setFeedback(null);
    const result = await onEditTransfer(editing.id, value);
    if (result.status === 'saved') setEditor(null);
    else if (result.status === 'validation') setFeedback(result.message);
    return result.status === 'saved';
  }

  async function removeTransfer(id: string): Promise<void> {
    setFeedback(null);
    const result = await onRemoveTransfer(id);
    if (result.status === 'validation') setFeedback(result.message);
  }

  return (
    <div className="account-map-setup-step account-map-transfers-step">
      <header>
        <p className="account-map-eyebrow">3 / 4 · 흐름 확인</p>
        <h1 id="account-map-setup-title">계좌 사이 흐름을 정해요</h1>
        <p>아래 제안은 아직 저장되지 않았어요. 확인한 흐름만 월 계획으로 추가합니다.</p>
      </header>
      {feedback === null ? null : <p className="account-map-error" role="alert">{feedback}</p>}
      <section className="account-map-transfer-suggestions" aria-labelledby="account-map-transfer-suggestions-title">
        <h2 id="account-map-transfer-suggestions-title">확인할 제안</h2>
        {suggestions.length === 0 ? <p className="account-map-hint">자동으로 확정할 수 있는 흐름이 없습니다. 필요하면 직접 추가해 주세요.</p> : (
          <ul>
            {suggestions.map((suggestion) => (
              <li key={`${suggestion.sourceLocationId}:${suggestion.targetLocationId}`}>
                <span>{locationName(suggestion.sourceLocationId)} → {locationName(suggestion.targetLocationId)}</span>
                <strong>{formatWon(suggestion.allocation.monthlyAmountWon)}</strong>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void saveNew({
                    sourceLocationId: suggestion.sourceLocationId,
                    targetLocationId: suggestion.targetLocationId,
                    allocation: suggestion.allocation,
                    status: 'active',
                  })}
                >제안 적용</button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="account-map-transfer-list" aria-labelledby="account-map-transfer-list-title">
        <div><h2 id="account-map-transfer-list-title">현재 흐름</h2><button type="button" disabled={disabled} onClick={() => setEditor('add')}>흐름 추가</button></div>
        {activeTransfers.length === 0 ? <p className="account-map-hint">아직 추가한 계좌 간 흐름이 없습니다.</p> : (
          <ul>
            {activeTransfers.map((transfer) => {
              const calculated = calculation.transfersById[transfer.id];
              return <li key={transfer.id}>
                <span>{locationName(transfer.sourceLocationId)} → {locationName(transfer.targetLocationId)}</span>
                <strong>{transfer.allocation.kind === 'sweep' ? '남은 금액 전부' : formatWon(calculated?.amountWon ?? transfer.allocation.monthlyAmountWon)}</strong>
                <div>
                  <button type="button" disabled={disabled} onClick={() => setEditor(transfer.id)}>수정</button>
                  <button type="button" disabled={disabled} onClick={() => void removeTransfer(transfer.id)}>삭제</button>
                </div>
              </li>;
            })}
          </ul>
        )}
      </section>
      {editor === null ? null : (
        <section className="account-map-setup-inline-editor" aria-label={editor === 'add' ? '계좌 흐름 추가' : '계좌 흐름 수정'}>
          <h2>{editor === 'add' ? '계좌 흐름 추가' : '계좌 흐름 수정'}</h2>
          <AccountTransferEditor
            key={editor}
            recoveryScope={editor === 'add' ? 'setup:add' : `setup:edit:${editor}`}
            locations={[...locations]}
            disabled={disabled}
            initialValue={editing}
            onCancel={() => setEditor(null)}
            onSave={(value) => editing === undefined ? saveNew(value) : saveEdit(value)}
          />
        </section>
      )}
    </div>
  );
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatWon(value: number): string {
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`;
}
