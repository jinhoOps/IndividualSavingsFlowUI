import { useRef } from 'react';
import { AppManagementMenu, type AppManagementItem } from '../../journey/ui/AppManagementMenu';
import { ManagementConfirmationDialog } from '../../journey/ui/ManagementConfirmationDialog';

export interface MainManagementMenuProps {
  saving: boolean;
  dirty: boolean;
  canExport: boolean;
  canImport: boolean;
  canRestart: boolean;
  importConfirmationOpen: boolean;
  importFailureMessage?: string;
  onCancel(): void;
  onRestart(): void;
  onExport(): void;
  onImportFile(file: File): void;
  onCancelImport(): void;
  onConfirmImport(): Promise<boolean>;
}

export function MainManagementMenu({
  saving,
  dirty,
  canExport,
  canImport,
  canRestart,
  importConfirmationOpen,
  importFailureMessage,
  onCancel,
  onRestart,
  onExport,
  onImportFile,
  onCancelImport,
  onConfirmImport,
}: MainManagementMenuProps) {
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const items = [
    {
      kind: 'message',
      id: 'main-backup-scope',
      text: 'Main·Simulation·Portfolio·Account Map의 모든 앱 데이터를 한 번에 백업하고 복원합니다.',
    },
    { kind: 'action', id: 'main-export', label: '백업 내보내기', disabled: saving || !canExport, onSelect: onExport },
    {
      kind: 'file',
      id: 'main-import',
      label: '백업 가져오기',
      accept: 'application/json,.json',
      disabled: saving || !canImport,
      onFile: (file: File) => {
        returnFocusRef.current = document.querySelector<HTMLElement>('[aria-label="관리 메뉴"]');
        onImportFile(file);
      },
    },
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

  return (
    <>
      <AppManagementMenu items={items} />
      {!importConfirmationOpen ? null : (
        <ManagementConfirmationDialog
          confirmation={{
            title: '모든 앱 데이터를 이 백업으로 바꿀까요?',
            description: '현재 Main, Simulation, Portfolio, Account Map 데이터가 백업 내용으로 한 번에 바뀝니다.',
            confirmLabel: '백업으로 바꾸기',
          }}
          pending={saving}
          errorMessage={importFailureMessage}
          returnFocusRef={returnFocusRef}
          onCancel={onCancelImport}
          onConfirm={() => {
            void onConfirmImport();
          }}
        />
      )}
    </>
  );
}
