import { useEffect, useRef, useState } from 'react';
import {
  createWorkspaceBackupExport,
  parseWorkspaceBackupCandidate,
  restoreWorkspaceBackup,
  type WorkspaceImportFailureReason,
} from '../application/mainBackupCommands';
import type { MainBootstrapResult } from '../application/bootstrap';
import type { MainState } from '../application/mainReducer';
import { exportRecoveryData } from '../infrastructure/backup';
import type { MainRepository } from '../infrastructure/mainRepository';
import type { WorkspaceDocument } from '../../workspace/domain/model';
import type { WorkspaceRepository } from '../../workspace/infrastructure/workspaceRepository';
import { downloadJson, readFileText } from './mainBrowserFiles';
import type { MainOperationGate } from './mainOperationGate';

interface UseMainBackupControllerOptions {
  state: MainState | null;
  mainRepository: MainRepository;
  workspaceRepository: Pick<WorkspaceRepository, 'load' | 'replace'>;
  operationGate: MainOperationGate;
  showIntro: boolean;
  onBootstrapAccepted(result: MainBootstrapResult): void;
}

type BackupStatus = { kind: 'success' | 'error'; message: string } | null;

const importMessages = {
  json: '백업 JSON을 읽을 수 없습니다. 현재 데이터는 바뀌지 않았습니다.',
  format: '새 전체 workspace 백업 파일만 가져올 수 있습니다. 현재 데이터는 바뀌지 않았습니다.',
  reference: '백업의 앱 연결 정보가 올바르지 않습니다. 현재 데이터는 바뀌지 않았습니다.',
  schema: '백업의 앱 데이터가 올바르지 않습니다. 현재 데이터는 바뀌지 않았습니다.',
} satisfies Record<WorkspaceImportFailureReason, string>;

const restoreMessages = {
  conflict: '다른 탭에서 데이터가 변경되었습니다. 현재 데이터는 바뀌지 않았습니다.',
  'current-invalid': '현재 저장된 workspace를 먼저 복구해야 합니다. 현재 데이터는 바뀌지 않았습니다.',
  'candidate-invalid': '백업의 앱 데이터를 적용할 수 없습니다. 현재 데이터는 바뀌지 않았습니다.',
  'unavailable-load': '저장소를 사용할 수 없습니다. 현재 데이터는 바뀌지 않았습니다. 다시 시도해 주세요.',
  'unavailable-replace': '백업을 저장하지 못했습니다. 현재 데이터는 바뀌지 않았습니다. 다시 시도해 주세요.',
  failed: '백업을 복원하지 못했습니다. 현재 데이터는 바뀌지 않았습니다. 다시 시도해 주세요.',
} as const;

export function useMainBackupController({
  state,
  mainRepository,
  workspaceRepository,
  operationGate,
  showIntro,
  onBootstrapAccepted,
}: UseMainBackupControllerOptions) {
  const [backupStatus, setBackupStatus] = useState<BackupStatus>(null);
  const [pendingImport, setPendingImport] = useState<WorkspaceDocument | null>(null);
  const [restorePending, setRestorePending] = useState(false);
  const selectionGenerationRef = useRef(0);
  const restoreFocusRequestedRef = useRef(false);

  useEffect(() => {
    if (!restoreFocusRequestedRef.current || backupStatus?.kind !== 'success' || showIntro) return;
    restoreFocusRequestedRef.current = false;
    const target = document.querySelector<HTMLElement>('[aria-label="관리 메뉴"]')
      ?? document.querySelector<HTMLElement>('[data-setup-heading]')
      ?? document.querySelector<HTMLElement>([
        '[aria-label="설정 단계"] button:not(:disabled)',
        '[aria-label="설정 단계"] input:not(:disabled)',
        '[aria-label="설정 단계"] [tabindex]:not([tabindex="-1"])',
      ].join(', '));
    target?.focus();
  }, [backupStatus, showIntro, state]);

  async function prepareWorkspaceImport(file: File) {
    if (state === null || state.mode !== 'dashboard' || operationGate.busy) return;
    const generation = selectionGenerationRef.current + 1;
    selectionGenerationRef.current = generation;
    try {
      const result = parseWorkspaceBackupCandidate(await readFileText(file));
      if (generation !== selectionGenerationRef.current) return;
      if (result.status === 'ready') {
        setPendingImport(result.candidate);
        setBackupStatus(null);
        return;
      }
      setPendingImport(null);
      setBackupStatus({
        kind: 'error',
        message: result.status === 'candidate-invalid'
          ? importMessages[result.reason]
          : '백업 파일을 읽지 못했습니다. 현재 데이터는 바뀌지 않았습니다.',
      });
    } catch {
      if (generation !== selectionGenerationRef.current) return;
      setPendingImport(null);
      setBackupStatus({ kind: 'error', message: '백업 파일을 읽지 못했습니다. 현재 데이터는 바뀌지 않았습니다.' });
    }
  }

  function cancelWorkspaceImport() {
    setPendingImport(null);
  }

  function clearBackupStatus() {
    setBackupStatus(null);
  }

  async function restorePendingImport(): Promise<boolean> {
    if (pendingImport === null || operationGate.busy) return false;
    operationGate.busy = true;
    setRestorePending(true);
    try {
      const result = await restoreWorkspaceBackup(pendingImport, workspaceRepository, mainRepository);
      if (result.status === 'restored') {
        restoreFocusRequestedRef.current = true;
        onBootstrapAccepted(result.bootstrap);
        setPendingImport(null);
        setBackupStatus({ kind: 'success', message: '모든 앱 데이터를 백업에서 복원했습니다.' });
        return true;
      }
      setBackupStatus({ kind: 'error', message: restoreFailureMessage(result) });
      return false;
    } finally {
      operationGate.busy = false;
      setRestorePending(false);
    }
  }

  function exportCurrentWorkspace() {
    const result = createWorkspaceBackupExport(workspaceRepository);
    if (result.status === 'current-invalid') {
      setBackupStatus({ kind: 'error', message: '현재 저장된 workspace를 먼저 복구해야 백업할 수 있습니다.' });
      return;
    }
    if (result.status === 'unavailable') {
      setBackupStatus({ kind: 'error', message: '저장소를 사용할 수 없어 백업하지 못했습니다.' });
      return;
    }
    if (result.status === 'failed' || !downloadJson(result.contents, 'individual-savings-flow-workspace.json')) {
      setBackupStatus({
        kind: 'error',
        message: '백업 파일을 다운로드하지 못했습니다. 브라우저 다운로드 설정을 확인하고 다시 시도해 주세요.',
      });
      return;
    }
    setBackupStatus({ kind: 'success', message: '모든 앱 데이터 백업을 내보냈습니다.' });
  }

  function exportRecoveryOriginal(original: unknown, raw?: string) {
    const downloaded = downloadJson(raw ?? exportRecoveryData(original), 'individual-savings-flow-recovery.json');
    setBackupStatus(downloaded
      ? { kind: 'success', message: '기존 원본 JSON을 다운로드했습니다.' }
      : {
        kind: 'error',
        message: '원본 JSON을 다운로드하지 못했습니다. 브라우저 다운로드 설정을 확인하고 다시 시도해 주세요.',
      });
  }

  return {
    backupStatus,
    pendingImport,
    restorePending,
    prepareWorkspaceImport,
    cancelWorkspaceImport,
    clearBackupStatus,
    restorePendingImport,
    exportCurrentWorkspace,
    exportRecoveryOriginal,
  };
}

function restoreFailureMessage(result: Exclude<Awaited<ReturnType<typeof restoreWorkspaceBackup>>, { status: 'restored' }>): string {
  if (result.status === 'unavailable') return restoreMessages[`unavailable-${result.stage}`];
  return restoreMessages[result.status];
}
