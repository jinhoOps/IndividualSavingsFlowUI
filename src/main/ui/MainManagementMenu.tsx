import { AppManagementMenu, type AppManagementItem } from '../../journey/ui/AppManagementMenu';

export interface MainManagementMenuProps {
  saving: boolean;
  dirty: boolean;
  canRestart: boolean;
  onCancel(): void;
  onRestart(): void;
}

export function MainManagementMenu({ saving, dirty, canRestart, onCancel, onRestart }: MainManagementMenuProps) {
  const items = [
    {
      kind: 'action',
      id: 'main-restart',
      label: '처음부터 다시',
      tone: 'danger',
      disabled: saving || !canRestart,
      confirmation: {
        title: '처음부터 다시 할까요?',
        description: '입력한 값은 유지한 채 설정 흐름을 다시 확인합니다.',
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
