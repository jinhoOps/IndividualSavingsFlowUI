import { AppManagementMenu, type AppManagementItem } from '../../journey/ui/AppManagementMenu';

export function PortfolioManagementMenu({ onReset }: { onReset(): void }) {
  const items = [{
    kind: 'action',
    id: 'portfolio-reset',
    label: '투자 배분 처음부터 다시',
    tone: 'danger',
    onSelect: onReset,
    confirmation: {
      title: '투자 배분을 처음부터 다시 할까요?',
      description: '투자 대상이 제거되고 투자금 전체가 현금으로 돌아갑니다.',
      confirmLabel: '초기화',
    },
  }] satisfies AppManagementItem[];

  return <AppManagementMenu items={items} />;
}
