import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/common/Button';
import type { PortfolioAction } from '../application/portfolioReducer';
import { materializeAllocation } from '../domain/allocation';
import type { PortfolioDraft } from '../domain/model';
import {
  createDraftFromAllocation,
  createDraftFromExample,
  PORTFOLIO_ASSETS,
  PORTFOLIO_EXAMPLES,
  type PortfolioAssetId,
  type PortfolioExampleLeg,
  type PortfolioExampleTag,
  type PortfolioRiskBand,
} from '../domain/portfolioExamples';
import { formatPortfolioWon } from './format';

const riskBandCopy: Record<PortfolioRiskBand, { title: string; description: string }> = {
  defensive: { title: '방어 지향', description: '이 샘플 안에서 레버리지를 쓰지 않고 금을 함께 두는 구성이에요.' },
  growth: { title: '성장 지향', description: '주식형 ETF 두 개를 함께 비교하는 구성이에요.' },
  aggressive: { title: '공격 지향', description: '레버리지나 BTC를 포함할 수 있는 구성이에요.' },
};

const riskBands: PortfolioRiskBand[] = ['defensive', 'growth', 'aggressive'];

export function PortfolioExamplePicker({
  draft,
  investmentWon,
  now,
  onAction,
  onClose,
}: {
  draft: PortfolioDraft;
  investmentWon: number;
  now(): number;
  onAction(action: PortfolioAction): void;
  onClose(): void;
}) {
  const [mode, setMode] = useState<'examples' | 'direct'>('examples');
  const [riskFilter, setRiskFilter] = useState<PortfolioRiskBand | 'all'>('all');
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(null);
  const [adjustedExampleLegs, setAdjustedExampleLegs] = useState<PortfolioExampleLeg[] | null>(null);
  const [leadAssetId, setLeadAssetId] = useState<PortfolioAssetId | ''>('');
  const [leadPercentage, setLeadPercentage] = useState(70);
  const [assistants, setAssistants] = useState<Array<PortfolioAssetId | ''>>(['']);
  const [confirmationCandidate, setConfirmationCandidate] = useState<PortfolioDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedExample = PORTFOLIO_EXAMPLES.find((example) => example.id === selectedExampleId) ?? null;
  const selectedExampleLegs = selectedExample === null
    ? []
    : adjustedExampleLegs ?? selectedExample.legs;
  const directLegs = useMemo(() => directComposition(leadAssetId, leadPercentage, assistants), [
    assistants,
    leadAssetId,
    leadPercentage,
  ]);
  const previewLegs = mode === 'examples' ? selectedExampleLegs : directLegs;
  const previewCandidate = useMemo(() => candidateForPreview(previewLegs, investmentWon), [
    investmentWon,
    previewLegs,
  ]);
  const hasExistingAllocation = draft.items.length > 0 || draft.cashMode === 'manual';

  useEffect(() => {
    setConfirmationCandidate(null);
  }, [draft.syncedInvestmentWon, draft.updatedAt]);

  function chooseMode(nextMode: 'examples' | 'direct'): void {
    setMode(nextMode);
    setConfirmationCandidate(null);
    setError(null);
  }

  function changeSelectedExampleLead(nextLeadPercentage: number): void {
    if (!isLeadPercentage(nextLeadPercentage) || selectedExample === null) {
      setError('invalid-example-allocation');
      return;
    }
    setAdjustedExampleLegs(rebalanceLead(selectedExample.legs, nextLeadPercentage));
    setConfirmationCandidate(null);
    setError(null);
  }

  function requestReplacement(): void {
    try {
      const candidate = mode === 'examples'
        ? selectedExample === null
          ? null
          : createDraftFromExample(selectedExample, investmentWon, now())
        : directLegs.length === 0
          ? null
          : createDraftFromAllocation(directLegs, investmentWon, now());
      if (candidate === null) return;
      setError(null);
      if (hasExistingAllocation) {
        setConfirmationCandidate(candidate);
        return;
      }
      replaceDraft(candidate);
    } catch (candidateError) {
      setError(candidateError instanceof Error ? candidateError.message : 'invalid-example-allocation');
    }
  }

  function replaceDraft(candidate: PortfolioDraft): void {
    onAction({ type: 'draft-replaced', draft: candidate });
    onClose();
  }

  function setAssistant(index: number, assetId: PortfolioAssetId | ''): void {
    setAssistants((current) => current.map((assistant, assistantIndex) => (
      assistantIndex === index ? assetId : assistant
    )));
  }

  return (
    <section className="portfolio-example-picker" aria-labelledby="portfolio-example-picker-title">
      <header className="portfolio-example-picker__header">
        <div>
          <p className="portfolio-example-picker__eyebrow">배분 시작 방식</p>
          <h2 id="portfolio-example-picker-title">샘플로 빠르게 시작할 수 있어요</h2>
        </div>
        <Button type="button" variant="quiet" onClick={onClose}>돌아가기</Button>
      </header>

      <p className="portfolio-example-picker__notice">
        예시는 투자 권유가 아니며, 위험도는 절대 순위가 아닌 구성을 고르는 보조 기준이에요.
      </p>
      <div className="portfolio-example-picker__mode" role="group" aria-label="배분 시작 방식 선택">
        <Button type="button" variant={mode === 'examples' ? 'primary' : 'secondary'} onClick={() => chooseMode('examples')}>샘플 보기</Button>
        <Button type="button" variant={mode === 'direct' ? 'primary' : 'secondary'} onClick={() => chooseMode('direct')}>직접 조합</Button>
      </div>

      {mode === 'examples' ? (
        <>
          <div className="portfolio-example-picker__filters" role="group" aria-label="샘플 위험 구간">
            <Button type="button" variant={riskFilter === 'all' ? 'primary' : 'secondary'} onClick={() => setRiskFilter('all')}>전체</Button>
            {riskBands.map((band) => (
              <Button key={band} type="button" variant={riskFilter === band ? 'primary' : 'secondary'} onClick={() => setRiskFilter(band)}>
                {riskBandCopy[band].title}
              </Button>
            ))}
          </div>
          <div className="portfolio-example-picker__groups">
            {riskBands.filter((band) => riskFilter === 'all' || riskFilter === band).map((band) => (
              <section key={band} className="portfolio-example-picker__group" aria-labelledby={`portfolio-risk-${band}`}>
                <h3 id={`portfolio-risk-${band}`}>{riskBandCopy[band].title}</h3>
                <p>{riskBandCopy[band].description}</p>
                <div className="portfolio-example-picker__options">
                  {PORTFOLIO_EXAMPLES.filter((example) => example.riskBand === band).map((example) => (
                    <button
                      type="button"
                      key={example.id}
                      className="portfolio-example-picker__option"
                      aria-label={example.title}
                      aria-pressed={selectedExample?.id === example.id}
                      onClick={() => {
                        setSelectedExampleId(example.id);
                        setAdjustedExampleLegs(null);
                        setConfirmationCandidate(null);
                        setError(null);
                      }}
                    >
                      <strong>{example.title}</strong>
                      <span>{example.tags.join(' · ')}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
          {selectedExample === null ? null : (
            <section className="portfolio-example-picker__adjustment" aria-labelledby="portfolio-example-adjustment-title">
              <div>
                <h3 id="portfolio-example-adjustment-title">샘플 비율 조정</h3>
                <p>{adjustedExampleLegs === null
                  ? `${riskBandCopy[selectedExample.riskBand].title} 기준 샘플이에요.`
                  : '샘플에서 조정한 구성 · 위험 구간 미평가'}</p>
              </div>
              <LeadPercentageControl
                value={selectedExampleLegs[0].percentage}
                onChange={changeSelectedExampleLead}
              />
              {adjustedExampleLegs === null ? null : (
                <Button type="button" variant="quiet" onClick={() => setAdjustedExampleLegs(null)}>샘플 비율로 되돌리기</Button>
              )}
            </section>
          )}
        </>
      ) : (
        <section className="portfolio-example-picker__direct" aria-labelledby="portfolio-direct-composition-title">
          <h3 id="portfolio-direct-composition-title">주 투자 대상부터 고르세요</h3>
          <p>위험 구간 미평가 · 주 투자 대상은 50%부터 90%까지 5% 단위로 정하고, 남은 비율은 보조 대상에 자동으로 나눠요.</p>
          <label>
            <span>주 투자 대상</span>
            <select
              aria-label="주 투자 대상"
              value={leadAssetId}
              onChange={(event) => setLeadAssetId(event.currentTarget.value as PortfolioAssetId | '')}
            >
              <option value="">선택하세요</option>
              {assetOptions().map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
          </label>
          <LeadPercentageControl value={leadPercentage} onChange={setLeadPercentage} />
          <label>
            <span>보조 투자 대상 1</span>
            <select
              aria-label="보조 투자 대상 1"
              value={assistants[0]}
              onChange={(event) => setAssistant(0, event.currentTarget.value as PortfolioAssetId | '')}
            >
              <option value="">선택하세요</option>
              {assetOptions([leadAssetId]).map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
          </label>
          {assistants.length === 2 ? (
            <>
              <label>
                <span>보조 투자 대상 2</span>
                <select
                  aria-label="보조 투자 대상 2"
                  value={assistants[1]}
                  onChange={(event) => setAssistant(1, event.currentTarget.value as PortfolioAssetId | '')}
                >
                  <option value="">선택하세요</option>
                  {assetOptions([leadAssetId, assistants[0]]).map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                </select>
              </label>
              <Button type="button" variant="quiet" onClick={() => setAssistants((current) => [current[0]])}>보조 대상 2 제거</Button>
            </>
          ) : (
            <Button type="button" variant="quiet" disabled={assistants[0] === ''} onClick={() => setAssistants((current) => [...current, ''])}>
              보조 대상 하나 더 추가
            </Button>
          )}
        </section>
      )}

      {previewCandidate.draft === null ? null : (
        <PortfolioExamplePreview draft={previewCandidate.draft} investmentWon={investmentWon} onUse={requestReplacement} />
      )}
      {previewLegs.length === 0 ? null : <PortfolioAssetNotes legs={previewLegs} />}
      {previewCandidate.error === null && error === null ? null : (
        <p className="portfolio-example-picker__error" role="alert">
          {exampleErrorMessage(error ?? previewCandidate.error!)}
        </p>
      )}
      {confirmationCandidate === null ? null : (
        <section className="portfolio-example-picker__confirmation" aria-labelledby="portfolio-example-confirm-title">
          <h3 id="portfolio-example-confirm-title">현재 초안을 이 구성으로 바꿀까요?</h3>
          <p>
            현재 초안 {draft.items.length}개를 새 구성 {confirmationCandidate.items.length}개로 바꾸고,
            기존 대상과 현금 배분을 교체합니다.
          </p>
          <div>
            <Button type="button" variant="secondary" onClick={() => setConfirmationCandidate(null)}>계속 편집</Button>
            <Button type="button" variant="primary" onClick={() => replaceDraft(confirmationCandidate)}>초안 바꾸기</Button>
          </div>
        </section>
      )}
    </section>
  );
}

function PortfolioAssetNotes({ legs }: { legs: readonly PortfolioExampleLeg[] }) {
  const assetIds = new Set(legs.map((leg) => leg.assetId));
  const tags = tagsForLegs(legs);
  return (
    <aside className="portfolio-example-picker__notes" aria-label="구성 유의사항">
      <p>구성 속성: {tags.join(' · ')}</p>
      {assetIds.has('QLD') ? <p>QLD는 나스닥100의 일간 수익률 2배를 목표로 하며, 장기 수익률이 두 배가 되는 뜻은 아니에요.</p> : null}
      {assetIds.has('BTC') ? <p>BTC는 변동성이 큰 가상자산이에요.</p> : null}
      {assetIds.has('GOLD') ? <p>금(GOLD)은 금 자산을 뜻하며, 실제 투자 수단은 이 앱이 대신 고르지 않아요.</p> : null}
    </aside>
  );
}

function PortfolioExamplePreview({
  draft,
  investmentWon,
  onUse,
}: {
  draft: PortfolioDraft;
  investmentWon: number;
  onUse(): void;
}) {
  const allocation = materializeAllocation(draft, investmentWon);
  return (
    <section className="portfolio-example-picker__preview" aria-labelledby="portfolio-example-preview-title">
      <h3 id="portfolio-example-preview-title">구성 미리보기</h3>
      <ul>
        {allocation.items.map((item) => (
          <li key={item.id}>
            <span>{item.name}</span>
            <strong>{item.percentage}% · {formatPortfolioWon(item.amountWon)}</strong>
          </li>
        ))}
      </ul>
      <Button type="button" variant="primary" onClick={onUse}>이 구성으로 채우기</Button>
    </section>
  );
}

function assetOptions(excluded: Array<PortfolioAssetId | ''> = []) {
  return Object.values(PORTFOLIO_ASSETS).filter((asset) => !excluded.includes(asset.id as PortfolioAssetId));
}

function directComposition(
  leadAssetId: PortfolioAssetId | '',
  leadPercentage: number,
  assistants: readonly (PortfolioAssetId | '')[],
): PortfolioExampleLeg[] {
  const activeAssistants = assistants.filter((assetId): assetId is PortfolioAssetId => assetId !== '');
  if (leadAssetId === '' || activeAssistants.length === 0 || activeAssistants.includes(leadAssetId)) return [];
  if (new Set(activeAssistants).size !== activeAssistants.length) return [];
  const remaining = 100 - leadPercentage;
  if (activeAssistants.length === 1) {
    return [{ assetId: leadAssetId, percentage: leadPercentage }, { assetId: activeAssistants[0], percentage: remaining }];
  }
  const firstAssistantPercentage = Math.ceil(remaining / 10) * 5;
  return [
    { assetId: leadAssetId, percentage: leadPercentage },
    { assetId: activeAssistants[0], percentage: firstAssistantPercentage },
    { assetId: activeAssistants[1], percentage: remaining - firstAssistantPercentage },
  ];
}

function LeadPercentageControl({
  value,
  onChange,
}: {
  value: number;
  onChange(value: number): void;
}) {
  return (
    <div className="portfolio-example-picker__lead-control" role="group" aria-label="주력 자산 비율">
      <span>주력 자산 비율</span>
      <div>
        <Button type="button" variant="secondary" aria-label="주력 비율 5% 낮추기" disabled={value <= 50} onClick={() => onChange(value - 5)}>−</Button>
        <output>{value}%</output>
        <Button type="button" variant="secondary" aria-label="주력 비율 5% 높이기" disabled={value >= 90} onClick={() => onChange(value + 5)}>+</Button>
      </div>
      <input
        type="range"
        min="50"
        max="90"
        step="5"
        value={value}
        aria-label="주력 자산 비율"
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </div>
  );
}

function rebalanceLead(legs: readonly PortfolioExampleLeg[], nextLeadPercentage: number): PortfolioExampleLeg[] {
  const [lead, ...assistants] = legs;
  const remaining = 100 - nextLeadPercentage;
  if (assistants.length === 1) return [{ ...lead, percentage: nextLeadPercentage }, { ...assistants[0], percentage: remaining }];
  const currentAssistantTotal = assistants.reduce((sum, assistant) => sum + assistant.percentage, 0);
  const firstAssistantPercentage = Math.max(5, Math.min(
    remaining - 5,
    5 * Math.round((remaining * assistants[0].percentage / currentAssistantTotal) / 5),
  ));
  return [
    { ...lead, percentage: nextLeadPercentage },
    { ...assistants[0], percentage: firstAssistantPercentage },
    { ...assistants[1], percentage: remaining - firstAssistantPercentage },
  ];
}

function candidateForPreview(legs: readonly PortfolioExampleLeg[], investmentWon: number): {
  draft: PortfolioDraft | null;
  error: string | null;
} {
  if (legs.length === 0) return { draft: null, error: null };
  try {
    return { draft: createDraftFromAllocation(legs, investmentWon, 0), error: null };
  } catch (candidateError) {
    return { draft: null, error: candidateError instanceof Error ? candidateError.message : 'invalid-example-allocation' };
  }
}

function isLeadPercentage(value: number): boolean {
  return Number.isInteger(value) && value >= 50 && value <= 90 && value % 5 === 0;
}

function tagsForLegs(legs: readonly PortfolioExampleLeg[]): PortfolioExampleTag[] {
  const tags = new Set<PortfolioExampleTag>();
  for (const leg of legs) {
    if (leg.assetId === 'SCHD') {
      tags.add('배당·인컴');
      tags.add('인덱스');
    } else if (leg.assetId === 'JEPQ') tags.add('배당·인컴');
    else if (leg.assetId === 'VOO' || leg.assetId === 'QQQM') tags.add('인덱스');
    else if (leg.assetId === 'QLD') tags.add('인덱스 레버리지');
    else if (leg.assetId === 'GOLD') tags.add('금');
    else if (leg.assetId === 'BTC') tags.add('BTC');
  }
  return [...tags];
}

function exampleErrorMessage(error: string): string {
  if (error === 'amount-below-minimum') return '이 투자금에서는 일부 배분 금액이 1,000원보다 작아요. 다른 구성을 선택해 주세요.';
  if (error === 'invalid-investment') return 'Main의 월 투자금을 먼저 확인해 주세요.';
  return '이 구성은 현재 투자금으로 만들 수 없어요. 다시 선택해 주세요.';
}
