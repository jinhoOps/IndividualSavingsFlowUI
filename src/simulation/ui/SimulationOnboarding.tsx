import { useContext, useState } from 'react';
import {
  AccountDraftContext,
  useAccountRecovery,
  useInitialRecovery,
} from '../../auth/AccountDraftContext';
import type { CompoundSimulationDraft, SimulationMainSource } from '../domain/model';
import {
  createDefaultSimulationDraft,
  parseSimulationDraft,
  targetForInitialInvestment,
} from '../domain/validation';
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

type OnboardingStage = 'principal' | 'goal' | 'return';

interface OnboardingRecoveryDraft {
  stage: OnboardingStage;
  draft: CompoundSimulationDraft;
}

function parseOnboardingRecoveryDraft(value: unknown): OnboardingRecoveryDraft | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const recovery = value as Record<string, unknown>;
  if (recovery.stage !== 'principal' && recovery.stage !== 'goal' && recovery.stage !== 'return') {
    return null;
  }
  const draft = parseSimulationDraft(recovery.draft);
  return draft === null ? null : { stage: recovery.stage, draft };
}

export function SimulationOnboarding({
  source,
  initialDraft,
  goalSaveState = 'idle',
  now,
  onComplete,
}: SimulationOnboardingProps) {
  const session = useContext(AccountDraftContext);
  const recovered = useInitialRecovery('simulation-onboarding', parseOnboardingRecoveryDraft);
  const [stage, setStage] = useState<OnboardingStage>(
    () => recovered?.stage ?? (initialDraft?.targetAmountWon === null ? 'goal' : 'principal'),
  );
  const [draft, setDraft] = useState(
    () => recovered?.draft ?? initialDraft ?? createDefaultSimulationDraft(source, now()),
  );
  const [dirty, setDirty] = useState(false);
  const resumedGoal = initialDraft?.targetAmountWon === null;

  useAccountRecovery('simulation-onboarding', { stage, draft }, dirty, dirty);

  function clearOnboardingRecovery(): void {
    session?.recordRecoveryDraft('simulation-onboarding', null);
    setDirty(false);
  }

  function continueFromPrincipal(initialInvestmentWon: number): void {
    const targetAmountWon = targetForInitialInvestment(initialInvestmentWon);
    setDraft((current) => ({ ...current, initialInvestmentWon, targetAmountWon }));
    setStage(targetAmountWon === null ? 'goal' : 'return');
    setDirty(true);
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
            clearOnboardingRecovery();
            onComplete(next);
          } else {
            setStage('return');
            setDirty(true);
          }
        }}
      />
    );
  }

  return (
    <ExpectedReturnStep
      draft={draft}
      onChange={(next) => {
        setDraft(next);
        setDirty(true);
      }}
      onComplete={() => {
        clearOnboardingRecovery();
        onComplete({ ...draft, updatedAt: now() });
      }}
    />
  );
}
