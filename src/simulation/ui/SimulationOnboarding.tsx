import { useState } from 'react';
import type { CompoundSimulationDraft, SimulationMainSource } from '../domain/model';
import { createDefaultSimulationDraft, targetForInitialInvestment } from '../domain/validation';
import { ExpectedReturnStep } from './ExpectedReturnStep';
import { GoalAmountStep } from './GoalAmountStep';
import { StartingPrincipalStep } from './StartingPrincipalStep';

export interface SimulationOnboardingProps {
  source: SimulationMainSource;
  initialDraft?: CompoundSimulationDraft;
  goalSaveState?: 'idle' | 'saving' | 'error';
  now(): number;
  onComplete(draft: CompoundSimulationDraft): void;
}

export function SimulationOnboarding({
  source,
  initialDraft,
  goalSaveState = 'idle',
  now,
  onComplete,
}: SimulationOnboardingProps) {
  const [stage, setStage] = useState<'principal' | 'goal' | 'return'>(
    initialDraft?.targetAmountWon === null ? 'goal' : 'principal',
  );
  const [draft, setDraft] = useState(() => initialDraft ?? createDefaultSimulationDraft(source, now()));
  const resumedGoal = initialDraft?.targetAmountWon === null;

  function continueFromPrincipal(initialInvestmentWon: number): void {
    const targetAmountWon = targetForInitialInvestment(initialInvestmentWon);
    setDraft((current) => ({ ...current, initialInvestmentWon, targetAmountWon }));
    setStage(targetAmountWon === null ? 'goal' : 'return');
  }

  if (stage === 'principal') {
    return <StartingPrincipalStep onContinue={continueFromPrincipal} />;
  }

  if (stage === 'goal') {
    return (
      <GoalAmountStep
        initialInvestmentWon={draft.initialInvestmentWon}
        completesOnSubmit={resumedGoal}
        submissionState={resumedGoal ? goalSaveState : 'idle'}
        onContinue={(targetAmountWon) => {
          const next = { ...draft, targetAmountWon, updatedAt: now() };
          setDraft(next);
          if (resumedGoal) {
            onComplete(next);
          } else {
            setStage('return');
          }
        }}
      />
    );
  }

  return (
    <ExpectedReturnStep
      draft={draft}
      onChange={setDraft}
      onComplete={() => onComplete({ ...draft, updatedAt: now() })}
    />
  );
}
