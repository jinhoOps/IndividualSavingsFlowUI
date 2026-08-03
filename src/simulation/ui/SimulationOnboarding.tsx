import { useState } from 'react';
import type { CompoundSimulationDraft, SimulationMainSource } from '../domain/model';
import { createDefaultSimulationDraft } from '../domain/validation';
import { ScenarioSetupStep } from './ScenarioSetupStep';
import { StartingPrincipalStep } from './StartingPrincipalStep';

export interface SimulationOnboardingProps {
  source: SimulationMainSource;
  now(): number;
  onComplete(draft: CompoundSimulationDraft): void;
}

export function SimulationOnboarding({
  source,
  now,
  onComplete,
}: SimulationOnboardingProps) {
  const [stage, setStage] = useState<'principal' | 'scenario'>('principal');
  const [draft, setDraft] = useState(() => createDefaultSimulationDraft(source, now()));

  if (stage === 'principal') {
    return <StartingPrincipalStep onContinue={(initialInvestmentWon) => {
      setDraft((current) => ({ ...current, initialInvestmentWon }));
      setStage('scenario');
    }} />;
  }

  return (
    <ScenarioSetupStep
      draft={draft}
      onChange={setDraft}
      onComplete={() => onComplete({ ...draft, updatedAt: now() })}
    />
  );
}
