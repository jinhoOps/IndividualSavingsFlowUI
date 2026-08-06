import { AppManagementMenu, type AppManagementItem } from '../../journey/ui/AppManagementMenu';

export interface MainManagementMenuProps {
  saving: boolean;
  dirty: boolean;
  canExport: boolean;
  canRestart: boolean;
  onCancel(): void;
  onRestart(): void;
  onExport(): void;
  onImportFile(file: File): void;
}

export function MainManagementMenu({
  saving,
  dirty,
  canExport,
  canRestart,
  onCancel,
  onRestart,
  onExport,
  onImportFile,
}: MainManagementMenuProps) {
  const items = [
    { kind: 'action', id: 'main-export', label: '백업 내보내기', disabled: saving || !canExport, onSelect: onExport },
    { kind: 'file', id: 'main-import', label: '백업 가져오기', accept: 'application/json,.json', disabled: saving, onFile: onImportFile },
    { kind: 'separator', id: 'main-reset-separator' },
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
