import { AppManagementMenu, type AppManagementItem } from '../../journey/ui/AppManagementMenu';
import {
  DEFAULT_PORTFOLIO_VIEW_PREFERENCES,
  type PortfolioViewPreferences,
} from '../domain/model';

export function PortfolioManagementMenu({
  onReset,
  preferences = DEFAULT_PORTFOLIO_VIEW_PREFERENCES,
  onPreferencesChange = () => undefined,
}: {
  onReset(): void;
  preferences?: PortfolioViewPreferences;
  onPreferencesChange?(preferences: PortfolioViewPreferences): void;
}) {
  const items = [{
    kind: 'control',
    id: 'portfolio-view-preferences',
    content: (
      <fieldset className="portfolio-view-preferences">
        <legend className="portfolio-view-preferences__legend">보기 설정</legend>
        <label className="portfolio-view-preferences__choice">
          <input
            className="portfolio-view-preferences__choice-input"
            type="checkbox"
            role="switch"
            checked={preferences.showAmounts}
            onChange={(event) => onPreferencesChange({ ...preferences, showAmounts: event.currentTarget.checked })}
          />
          금액 보기
        </label>
        <fieldset className="portfolio-view-preferences__sort">
          <legend className="portfolio-view-preferences__legend">정렬</legend>
          <label className="portfolio-view-preferences__choice">
            <input
              className="portfolio-view-preferences__choice-input"
              type="radio"
              name="portfolio-sort-mode"
              checked={preferences.sortMode === 'ratio'}
              onChange={() => onPreferencesChange({ ...preferences, sortMode: 'ratio' })}
            />
            비율순
          </label>
          <label className="portfolio-view-preferences__choice">
            <input
              className="portfolio-view-preferences__choice-input"
              type="radio"
              name="portfolio-sort-mode"
              checked={preferences.sortMode === 'input'}
              onChange={() => onPreferencesChange({ ...preferences, sortMode: 'input' })}
            />
            입력순
          </label>
        </fieldset>
      </fieldset>
    ),
  }, {
    kind: 'separator',
    id: 'portfolio-view-preferences-separator',
  }, {
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
