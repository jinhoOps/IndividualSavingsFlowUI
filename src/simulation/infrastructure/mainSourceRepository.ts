import { isMainDataShape, validateMainData } from '../../main/domain/validation';
import { WORKSPACE_STORAGE_KEY } from '../../workspace/domain/model';
import {
  BrowserWorkspaceRepository,
  type WorkspaceRepository,
} from '../../workspace/infrastructure/workspaceRepository';
import type { SimulationMainSource } from '../domain/model';

export const MAIN_STORAGE_KEY = WORKSPACE_STORAGE_KEY;

export type MainSourceLoadResult =
  | { status: 'found'; source: SimulationMainSource }
  | { status: 'empty' }
  | { status: 'invalid' }
  | { status: 'unavailable' };

export interface MainSourceRepository {
  load(): MainSourceLoadResult;
}

export class BrowserMainSourceRepository implements MainSourceRepository {
  constructor(
    private readonly workspaceRepository: Pick<WorkspaceRepository, 'load'> = new BrowserWorkspaceRepository(),
  ) {}

  load(): MainSourceLoadResult {
    const loaded = this.workspaceRepository.load();
    if (loaded.status === 'invalid' || loaded.status === 'unavailable') {
      return { status: loaded.status };
    }
    const applied = loaded.workspace.main.applied;
    if (applied === null) return { status: 'empty' };
    if (!isMainDataShape(applied) || !validateMainData(applied).valid) {
      return { status: 'invalid' };
    }
    return {
      status: 'found',
      source: {
        monthlySavingsWon: applied.monthlySavingWon,
        monthlyInvestmentWon: applied.monthlyInvestmentWon,
        mainUpdatedAt: applied.updatedAt,
      },
    };
  }
}
