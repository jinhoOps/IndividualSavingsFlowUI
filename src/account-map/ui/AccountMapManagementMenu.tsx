import { AppManagementMenu } from '../../journey/ui/AppManagementMenu';

export function AccountMapManagementMenu({ hasMap }: { hasMap: boolean }) {
  return <AppManagementMenu items={[
    { kind: 'message', id: 'account-map-status', text: hasMap ? '연결 지도 관리' : '아직 만든 연결 지도가 없습니다' },
  ]} />;
}
