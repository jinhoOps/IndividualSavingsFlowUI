import { AppManagementMenu } from '../../journey/ui/AppManagementMenu';

export function AccountMapManagementMenu({ hasMap, hasLegacy = false, onReset = async () => false }: { hasMap: boolean; hasLegacy?: boolean; onReset?(): Promise<boolean> }) {
  return <AppManagementMenu items={[
    ...(hasLegacy ? [{ kind: 'message' as const, id: 'legacy-data', text: '이전 형식 데이터가 호환용으로 보존되어 있습니다' }] : []),
    ...(hasMap ? [{
      kind: 'action' as const,
      id: 'reset-map',
      label: '월 연결 다시 만들기',
      tone: 'danger' as const,
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
