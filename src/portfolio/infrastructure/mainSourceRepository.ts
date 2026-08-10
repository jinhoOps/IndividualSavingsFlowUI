import { isMainDataShape, validateMainData } from '../../main/domain/validation';
import { WORKSPACE_STORAGE_KEY } from '../../workspace/domain/model';
import {
  BrowserWorkspaceRepository,
  type WorkspaceRepository,
} from '../../workspace/infrastructure/workspaceRepository';

export const MAIN_STORAGE_KEY = WORKSPACE_STORAGE_KEY;

export interface PortfolioMainSource {
  monthlyInvestmentWon: number;
  mainUpdatedAt: number;
}

export type PortfolioMainSourceLoadResult =
  | { status: 'found'; source: PortfolioMainSource }
  | { status: 'empty' }
  | { status: 'invalid' }
  | { status: 'unavailable' };

export interface PortfolioMainSourceRepository {
  load(): PortfolioMainSourceLoadResult;
}

export class BrowserPortfolioMainSourceRepository implements PortfolioMainSourceRepository {
  constructor(
    private readonly workspaceRepository: Pick<WorkspaceRepository, 'load'> = new BrowserWorkspaceRepository(),
  ) {}

  load(): PortfolioMainSourceLoadResult {
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
        monthlyInvestmentWon: applied.monthlyInvestmentWon,
        mainUpdatedAt: applied.updatedAt,
      },
    };
  }
}
