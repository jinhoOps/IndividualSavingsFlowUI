import { AppManagementMenu, type AppManagementItem } from '../../journey/ui/AppManagementMenu';

export interface MainManagementMenuProps {
  saving: boolean;
  dirty: boolean;
  canRestart: boolean;
  onCancel(): void;
  onRestart(): void;
  onReset(): Promise<boolean>;
}

export function MainManagementMenu({ saving, dirty, canRestart, onCancel, onRestart, onReset }: MainManagementMenuProps) {
  const items = [
    {
      kind: 'action',
      id: 'main-restart',
      label: '처음부터 다시',
      tone: 'danger',
      disabled: saving || !canRestart,
      confirmation: {
        title: '처음부터 다시 할까요?',
        description: '초기화하면 입력과 도우미 내역을 지웁니다. 월 계획은 새 설정 적용 후 바뀝니다.',
        failureMessage: '초기화하지 못했습니다. 닫은 뒤 저장 상태를 확인해주세요.',
        alternateAction: { label: '초기화', delayMs: 2500, onSelect: onReset },
        confirmLabel: '다시 시작',
      },
      onSelect: () => {
        if (dirty) onCancel();
        onRestart();
      },
    },
  ] satisfies AppManagementItem[];
  return <AppManagementMenu items={items} />;
}
