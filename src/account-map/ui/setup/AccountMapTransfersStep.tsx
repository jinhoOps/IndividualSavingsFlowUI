import { useEffect, useRef, useState, type JSX } from 'react';
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
  onEditingChange?(editing: boolean): void;
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
  onEditingChange,
}: AccountMapTransfersStepProps): JSX.Element {
  const [offeredSuggestions, setOfferedSuggestions] = useState(suggestions);
  const acceptedSuggestionIds = useRef(new Set<string>());
  const basis = JSON.stringify({ links: draft.links, locations });
  useEffect(() => { setOfferedSuggestions(suggestions); acceptedSuggestionIds.current.clear(); }, [basis]);
  useEffect(() => { if (draft.transfers.some(({ id }) => !acceptedSuggestionIds.current.has(id))) setOfferedSuggestions([]); }, [draft.transfers]);
  const visibleSuggestions = offeredSuggestions.filter((suggestion) => !draft.transfers.some((transfer) => transfer.sourceLocationId === suggestion.sourceLocationId && transfer.targetLocationId === suggestion.targetLocationId));
  const [editor, setEditor] = useState<'add' | string | null>(null);
  const editorRef = useRef<HTMLElement>(null);
  useEffect(() => { onEditingChange?.(editor !== null); return () => onEditingChange?.(false); }, [editor, onEditingChange]);
  useEffect(() => { if (editor !== null) { editorRef.current?.querySelector<HTMLElement>('h2')?.focus(); editorRef.current?.scrollIntoView?.({ block: 'nearest' }); } }, [editor]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const activeTransfers = draft.transfers.filter((transfer) => transfer.status === 'active');
  const editing = editor === null || editor === 'add'
    ? undefined
    : draft.transfers.find((transfer) => transfer.id === editor);
  const locationName = (locationId: string): string => locations.find((location) => location.id === locationId)?.shortName ?? '알 수 없는 계좌';

  async function saveNew(value: AccountTransferEditorValue, suggested = false): Promise<boolean> {
    setFeedback(null);
    const id = `transfer:${createId()}`;
    if (suggested) acceptedSuggestionIds.current.add(id);
    else setOfferedSuggestions([]);
    const result = await onAddTransfer({ ...value, id });
    if (result.status !== 'saved') acceptedSuggestionIds.current.delete(id);
    if (result.status === 'saved') setEditor(null);
    else if (result.status === 'validation') setFeedback(result.message);
    return result.status === 'saved';
  }

  async function saveEdit(value: AccountTransferEditorValue): Promise<boolean> {
    if (editing === undefined) return false;
    setFeedback(null);
    setOfferedSuggestions([]);
    const result = await onEditTransfer(editing.id, value);
    if (result.status === 'saved') setEditor(null);
    else if (result.status === 'validation') setFeedback(result.message);
    return result.status === 'saved';
  }

  async function removeTransfer(id: string): Promise<void> {
    setFeedback(null);
    setOfferedSuggestions([]);
    const result = await onRemoveTransfer(id);
    if (result.status === 'validation') setFeedback(result.message);
  }

  return (
    <div className="account-map-setup-step account-map-transfers-step">
      <header>
        <p className="account-map-eyebrow">3 / 4 · 흐름 확인</p>
        <h1 id="account-map-setup-title">계좌 사이 흐름을 정해요</h1>
        <p>연결한 계좌 사이에 돈을 옮길 계획이 있나요? 제안을 확인해 추가하거나 직접 정할 수 있어요.</p>
      </header>
      {feedback === null ? null : <p className="account-map-error" role="alert">{feedback}</p>}
      <section hidden={editor !== null} className="account-map-transfer-suggestions" aria-labelledby="account-map-transfer-suggestions-title">
        <h2 id="account-map-transfer-suggestions-title">확인할 제안</h2>
        {visibleSuggestions.length === 0 ? <p className="account-map-hint">추가할 제안이 없어요. 한 계좌에서 모두 쓴다면 이체 계획 없이 다음으로 넘어가도 됩니다.</p> : (
          <ul>
            {visibleSuggestions.map((suggestion) => (
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
                  }, true)}
                >제안 적용</button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section hidden={editor !== null} className="account-map-transfer-list" aria-labelledby="account-map-transfer-list-title">
        <div><h2 id="account-map-transfer-list-title">현재 흐름</h2><button type="button" disabled={disabled || locations.filter(({ archivedAt }) => archivedAt === undefined).length < 2} onClick={() => setEditor('add')}>흐름 추가</button></div>
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
        <section ref={editorRef} className="account-map-setup-inline-editor" aria-label={editor === 'add' ? '계좌 흐름 추가' : '계좌 흐름 수정'}>
          <h2 tabIndex={-1}>{editor === 'add' ? '계좌 흐름 추가' : '계좌 흐름 수정'}</h2>
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
