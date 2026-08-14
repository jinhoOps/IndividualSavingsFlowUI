import { AppManagementMenu } from '../../journey/ui/AppManagementMenu';

export interface ArchivedPurposeManagementItem {
  id: `custom:${string}`;
  name: string;
  parentName: string;
  targetMonthlyWon: number;
}

export interface ArchivedLocationManagementItem {
  id: string;
  shortName: string;
  institutionName: string;
}

export function AccountMapManagementMenu({ hasMap, hasLegacy = false, archivedPurposes = [], archivedLocations = [], mutationsDisabled = false, onRestorePurpose = () => undefined, onRestoreLocation = () => undefined, onReset = async () => false }: { hasMap: boolean; hasLegacy?: boolean; archivedPurposes?: readonly ArchivedPurposeManagementItem[]; archivedLocations?: readonly ArchivedLocationManagementItem[]; mutationsDisabled?: boolean; onRestorePurpose?(purposeId: `custom:${string}`): void; onRestoreLocation?(locationId: string): void; onReset?(): Promise<boolean> }) {
  return <AppManagementMenu items={[
    ...(hasLegacy ? [{ kind: 'message' as const, id: 'legacy-data', text: '이전 형식 데이터가 호환용으로 보존되어 있습니다' }] : []),
    ...(archivedPurposes.length === 0 ? [] : [
      { kind: 'message' as const, id: 'archived-purpose-count', text: `보관된 목적 ${archivedPurposes.length}개` },
      ...archivedPurposes.map((purpose) => ({
        kind: 'action' as const,
        id: `restore:${purpose.id}`,
        label: `${purpose.name} · ${purpose.parentName} · ${formatWon(purpose.targetMonthlyWon)}`,
        disabled: mutationsDisabled,
        onSelect: () => onRestorePurpose(purpose.id),
      })),
      { kind: 'separator' as const, id: 'archived-purpose-separator' },
    ]),
    ...(archivedLocations.length === 0 ? [] : [
      { kind: 'message' as const, id: 'archived-location-count', text: `보관된 계좌·보관처 ${archivedLocations.length}개` },
      ...archivedLocations.map((location) => ({
        kind: 'action' as const,
        id: `restore-location:${location.id}`,
        label: `${location.shortName} · ${location.institutionName}`,
        disabled: mutationsDisabled,
        onSelect: () => onRestoreLocation(location.id),
      })),
      { kind: 'separator' as const, id: 'archived-location-separator' },
    ]),
    ...(hasMap ? [{
      kind: 'action' as const,
      id: 'reset-map',
      label: '월 연결 다시 만들기',
      tone: 'danger' as const,
      disabled: mutationsDisabled,
      onSelect: onReset,
      confirmation: {
        title: '월 연결을 다시 만들까요?',
        description: '현재 연결과 세부 목적만 지웁니다. 계좌·보관처와 Main, Simulation, Portfolio는 유지됩니다.',
        confirmLabel: '다시 만들기',
        failureMessage: '초기화하지 못했습니다. 현재 지도는 유지됩니다.',
      },
    }] : [{ kind: 'message' as const, id: 'account-map-status', text: '아직 만든 연결 지도가 없습니다' }]),
  ]} />;
}

function formatWon(value: number): string { return `${new Intl.NumberFormat('ko-KR').format(value)}원`; }
