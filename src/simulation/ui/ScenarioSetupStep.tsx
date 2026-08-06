import { useEffect, useRef } from 'react';
import { Button } from '../../components/common/Button';
import { Surface } from '../../components/common/Surface';
import type { CompoundSimulationDraft } from '../domain/model';
import { projectCompoundGrowth } from '../domain/projection';
import { buildChartGeometry } from './chartGeometry';
import { formatWon } from './format';
import { SimulationControls } from './SimulationControls';

export function ScenarioSetupStep({
  draft,
  onChange,
  onComplete,
}: {
  draft: CompoundSimulationDraft;
  onChange(next: CompoundSimulationDraft): void;
  onComplete(): void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  const result = projectCompoundGrowth(draft);
  const geometry = buildChartGeometry(result.points, draft.amountMode, {
    width: 520,
    height: 160,
  });

  return (
    <Surface as="section" className="simulation-onboarding-step" aria-labelledby="scenario-title">
      <p className="simulation-eyebrow">계산 조건</p>
      <h1 id="scenario-title" ref={headingRef} tabIndex={-1}>
        얼마나 오래, 어느 정도 수익을 기대할까요?
      </h1>
      <SimulationControls draft={draft} onChange={onChange} />
      <p className="simulation-preset-note">
        수익률 선택값은 상품 추천이나 과거 성과가 아닌 계산 가정입니다.
      </p>
      <div className="simulation-onboarding-preview" aria-live="polite">
        <strong>
          {draft.years === 0
            ? `현재 시작 자산은 ${formatWon(result.finalCurrentPlanWon)}입니다!`
            : `이대로 ${draft.years}년 유지하면 ${formatWon(result.finalCurrentPlanWon)}이 됩니다!`}
        </strong>
        <svg viewBox="0 0 520 160" role="img" aria-label="설정 결과 미리보기">
          <path className="growth-chart__area" d={geometry.currentPlanAreaPath} />
          <path className="growth-chart__current" d={geometry.currentPlanPath} />
          <path className="growth-chart__savings" d={geometry.allSavingsPath} />
        </svg>
      </div>
      <Button type="button" variant="primary" onClick={onComplete}>
        결과 보기
      </Button>
    </Surface>
  );
}
