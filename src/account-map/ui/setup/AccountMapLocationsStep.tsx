import { useState, type JSX } from 'react';
import type { MainData } from '../../../main/domain/model';
import type { FinancialLocation } from '../../../workspace/domain/financialLocation';
import type { AccountMapDraftV2, PurposeId } from '../../domain/model';
import { reconcilePurpose } from '../../domain/reconciliation';
import { AccountMapLocationPicker } from '../AccountMapLocationPicker';

const SYSTEM_PURPOSES: readonly { id: PurposeId; label: string; prompt: string }[] = [
  { id: 'system:income', label: '수입', prompt: '어디로 들어오나요?' },
  { id: 'system:housing', label: '주거', prompt: '어디에서 나가나요?' },
  { id: 'system:living', label: '생활비', prompt: '어디에서 쓰나요?' },
  { id: 'system:saving', label: '저축', prompt: '어디에 모으나요?' },
  { id: 'system:investing', label: '투자', prompt: '어디에 두나요?' },
];

export interface AccountMapLocationsStepProps {
  main: MainData;
  locations: readonly FinancialLocation[];
  draft: AccountMapDraftV2;
  disabled?: boolean;
  onCommitConnection(input: {
    purposeId: PurposeId;
    locationId: string;
    newLocation?: FinancialLocation;
    monthlyAmountWon?: number;
    restoreLocation?: boolean;
  }): Promise<boolean>;
  onAddCustomPurpose(): void;
}

/** Purpose destinations stay distinct from the account-to-account transfers in the next step. */
export function AccountMapLocationsStep({
  main,
  locations,
  draft,
  disabled = false,
  onCommitConnection,
  onAddCustomPurpose,
}: AccountMapLocationsStepProps): JSX.Element {
  const [selectedPurposeId, setSelectedPurposeId] = useState<PurposeId | null>(null);
  const selectedPurpose = selectedPurposeId === null
    ? undefined
    : purposeMetadata(selectedPurposeId, draft);
  const activeLinks = selectedPurposeId === null
    ? []
    : draft.links.filter((link) => link.purposeId === selectedPurposeId && link.status === 'active');

  return (
    <div className="account-map-setup-step account-map-locations-step">
      <header>
        <p className="account-map-eyebrow">2 / 4 · 위치 확인</p>
        <h1 id="account-map-setup-title">돈이 머무는 곳을 연결해요</h1>
        <p>수입이 들어오고 각 목적에 쓰이거나 남는 계좌·보관처를 확인해 주세요.</p>
      </header>
      <div className="account-map-locations-step__list">
        {visiblePurposes(draft).map((purpose) => {
          const status = reconcilePurpose(purpose.id, draft, locations, main);
          const connected = draft.links.filter((link) => link.purposeId === purpose.id && link.status === 'active');
          return (
            <article key={purpose.id} className="account-map-location-row">
              <div>
                <p>{purpose.prompt}</p>
                <h2>{purpose.label}</h2>
                <small>{connected.length === 0 ? '연결 필요' : `${connected.length}곳 연결됨`}</small>
              </div>
              <strong>{formatWon(status.targetWon)}</strong>
              <button type="button" disabled={disabled} onClick={() => setSelectedPurposeId(purpose.id)}>
                {connected.length === 0 ? '연결' : '다른 계좌 연결'}
              </button>
            </article>
          );
        })}
      </div>
      <button type="button" className="account-map-add-purpose" disabled={disabled} onClick={onAddCustomPurpose}><span aria-hidden="true">＋</span> 세부 목적 추가</button>
      {selectedPurpose === undefined || selectedPurposeId === null ? null : (
        <section className="account-map-setup-inline-editor" role="dialog" aria-label={`${selectedPurpose.label} 연결`}>
          <header>
            <p>{selectedPurpose.prompt}</p>
            <h2>{selectedPurpose.label} 연결</h2>
          </header>
          <AccountMapLocationPicker
            key={selectedPurposeId}
            recoveryScope={selectedPurposeId}
            locations={[...locations]}
            linkedLocationIds={new Set(draft.links.filter((link) => link.purposeId === selectedPurposeId).map((link) => link.locationId))}
            amountRequired={activeLinks.length > 0}
            disabled={disabled}
            onCancel={() => setSelectedPurposeId(null)}
            onSelect={async (locationId, monthlyAmountWon) => {
              const location = locations.find((item) => item.id === locationId);
              const saved = await onCommitConnection({
                purposeId: selectedPurposeId,
                locationId,
                ...(location?.archivedAt === undefined ? {} : { restoreLocation: true }),
                ...(monthlyAmountWon === undefined ? {} : { monthlyAmountWon }),
              });
              if (saved) setSelectedPurposeId(null);
              return saved;
            }}
            onCreate={async (newLocation, monthlyAmountWon) => {
              const saved = await onCommitConnection({
                purposeId: selectedPurposeId,
                locationId: newLocation.id,
                newLocation,
                ...(monthlyAmountWon === undefined ? {} : { monthlyAmountWon }),
              });
              if (saved) setSelectedPurposeId(null);
              return saved;
            }}
          />
        </section>
      )}
    </div>
  );
}

function visiblePurposes(draft: AccountMapDraftV2): Array<{ id: PurposeId; label: string; prompt: string }> {
  return [
    ...SYSTEM_PURPOSES,
    ...draft.customPurposes
      .filter((purpose) => purpose.archivedAt === undefined)
      .map((purpose) => ({ id: purpose.id as PurposeId, label: purpose.name, prompt: '어디에서 쓰거나 남기나요?' })),
  ];
}

function purposeMetadata(id: PurposeId, draft: AccountMapDraftV2): { label: string; prompt: string } | undefined {
  const system = SYSTEM_PURPOSES.find((purpose) => purpose.id === id);
  if (system !== undefined) return system;
  const custom = draft.customPurposes.find((purpose) => purpose.id === id);
  return custom === undefined ? undefined : { label: custom.name, prompt: '어디에서 쓰거나 남기나요?' };
}

function formatWon(value: number): string {
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`;
}
