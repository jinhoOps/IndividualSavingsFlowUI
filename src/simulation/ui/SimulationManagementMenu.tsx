import { AppManagementMenu, type AppManagementItem } from '../../journey/ui/AppManagementMenu';

export function SimulationManagementMenu({
  onReset,
  resetFailed,
}: {
  onReset(): void;
  resetFailed: boolean;
}) {
  const items = [{
    kind: 'action',
    id: 'simulation-reset',
    label: '시뮬레이션 다시 설정',
    tone: 'danger',
    onSelect: onReset,
    confirmation: {
      title: '시뮬레이션을 다시 설정할까요?',
      description: 'Simulation에서 설정한 값만 지우고 다시 시작합니다.',
      confirmLabel: '다시 설정',
    },
  }] satisfies AppManagementItem[];

  return (
    <div className="journey-management-adapter">
      <AppManagementMenu items={items} />
      {resetFailed ? <p className="journey-management__inline-alert" role="alert">시뮬레이션을 다시 설정하지 못했어요.</p> : null}
    </div>
  );
}
