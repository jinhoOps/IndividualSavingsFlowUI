import type {WorkspaceDocument} from '../workspace/domain/model';
import {exportWorkspaceBackup} from '../workspace/infrastructure/workspaceBackup';

export function downloadText(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadWorkspace(workspace: WorkspaceDocument): void {
  downloadText('isf-workspace-backup.json', exportWorkspaceBackup(workspace));
}
export function workspaceSummary(workspace: WorkspaceDocument): string {
  const main = workspace.main.applied;
  return main ? `월 수입 ${main.monthlyNetIncomeWon.toLocaleString('ko-KR')}원 · 계좌·보관처 ${workspace.locations.length}개`
    : workspace.main.setupProgress ? 'Main 설정 중인 계획' : '아직 적용된 Main 계획이 없습니다.';
}
