import {
  archiveLocation,
  createLocation,
  renameLocation,
  setLocationRoles,
  type LocationCommandDependencies,
  type LocationCommandError,
  type LocationCommandResult,
  type PortfolioReferenceDisposition,
} from '../../workspace/domain/locationCommands';
import {
  normalizeLocationName,
  type FinancialLocation,
  type FinancialLocationKind,
  type InstitutionRef,
} from '../../workspace/domain/financialLocation';
import type { WorkspaceDocument } from '../../workspace/domain/model';
import {
  BrowserWorkspaceRepository,
  type WorkspaceRepository,
  type WorkspaceWriteResult,
} from '../../workspace/infrastructure/workspaceRepository';

export type LocationWriteError = LocationCommandError | 'stale-location' | 'conflict' | 'unavailable';

export type LocationPortfolioStatus = 'empty' | 'applied' | 'draft' | 'applied-and-draft';

export interface InvestmentLocationView extends FinancialLocation {
  portfolioStatus: LocationPortfolioStatus;
}

export type LocationWriteResult =
  | { status: 'saved'; location: FinancialLocation }
  | {
    status: LocationWriteError;
    referencedScopes?: string[];
    existingLocation?: FinancialLocation;
  };

export interface InvestmentLocationRepository {
  list(): InvestmentLocationView[];
  create(input: {
    shortName: string;
    institution?: InstitutionRef;
    kind: FinancialLocationKind;
  }): Promise<LocationWriteResult>;
  link(id: string): Promise<LocationWriteResult>;
  rename(id: string, shortName: string): Promise<LocationWriteResult>;
  archive(
    id: string,
    disposition?: PortfolioReferenceDisposition,
  ): Promise<LocationWriteResult>;
  subscribe(listener: (locations: InvestmentLocationView[]) => void): () => void;
}

export class BrowserInvestmentLocationRepository implements InvestmentLocationRepository {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository = new BrowserWorkspaceRepository(),
    private readonly dependencies: Partial<LocationCommandDependencies> = {},
  ) {}

  list(): InvestmentLocationView[] {
    const loaded = this.workspaceRepository.load();
    if (loaded.status === 'invalid' || loaded.status === 'unavailable') return [];
    return selectInvestmentLocations(loaded.workspace);
  }

  async create(input: {
    shortName: string;
    institution?: InstitutionRef;
    kind: FinancialLocationKind;
  }): Promise<LocationWriteResult> {
    return await this.run((workspace) => createLocation(workspace, {
      ...input,
      roles: ['investing'],
    }, this.dependencies), (workspace, failure) => {
      if (failure.reason !== 'duplicate-name') return commandFailure(failure);
      const normalized = normalizeLocationName(input.shortName);
      const existingLocation = workspace.locations.find((location) => (
        location.archivedAt === undefined
        && !location.roles.includes('investing')
        && normalizeLocationName(location.shortName) === normalized
      ));
      return existingLocation === undefined
        ? commandFailure(failure)
        : {
          status: 'duplicate-name',
          existingLocation: structuredClone(existingLocation),
        };
    });
  }

  async rename(id: string, shortName: string): Promise<LocationWriteResult> {
    return await this.run((workspace) => renameLocation(
      workspace,
      id,
      shortName,
      this.dependencies.now?.() ?? Date.now(),
    ), undefined, (workspace) => targetPrecondition(workspace, id, 'active-investing'));
  }

  async link(id: string): Promise<LocationWriteResult> {
    return await this.run((workspace) => {
      const current = workspace.locations.find((location) => location.id === id);
      if (current === undefined) {
        return setLocationRoles(workspace, id, ['investing'], undefined,
          this.dependencies.now?.() ?? Date.now());
      }
      return setLocationRoles(
        workspace,
        id,
        [...current.roles, ...(current.roles.includes('investing') ? [] : ['investing' as const])],
        undefined,
        this.dependencies.now?.() ?? Date.now(),
      );
    }, undefined, (workspace) => targetPrecondition(workspace, id, 'active-non-investing'));
  }

  async archive(
    id: string,
    disposition?: PortfolioReferenceDisposition,
  ): Promise<LocationWriteResult> {
    return await this.run((workspace) => archiveLocation(
      workspace,
      id,
      disposition,
      this.dependencies.now?.() ?? Date.now(),
    ), undefined, (workspace) => targetPrecondition(workspace, id, 'active-investing'));
  }

  subscribe(listener: (locations: InvestmentLocationView[]) => void): () => void {
    return this.workspaceRepository.subscribe((workspace) => {
      listener(selectInvestmentLocations(workspace));
    });
  }

  private async run(
    command: (workspace: WorkspaceDocument) => LocationCommandResult,
    onFailure?: (
      workspace: WorkspaceDocument,
      result: Extract<LocationCommandResult, { ok: false }>,
    ) => LocationWriteResult,
    precondition?: (workspace: WorkspaceDocument) => LocationWriteResult | undefined,
  ): Promise<LocationWriteResult> {
    try {
      const loaded = this.workspaceRepository.load();
      if (loaded.status === 'invalid' || loaded.status === 'unavailable') {
        return { status: 'unavailable' };
      }
      const preconditionResult = precondition?.(loaded.workspace);
      if (preconditionResult !== undefined) return preconditionResult;
      const commandResult = command(loaded.workspace);
      if (!commandResult.ok) {
        return onFailure?.(loaded.workspace, commandResult) ?? commandFailure(commandResult);
      }

      const writeResult = await this.workspaceRepository.update(
        loaded.workspace.revision,
        () => commandResult.workspace,
      );
      return writeOutcome(writeResult, commandResult.location.id);
    } catch {
      return { status: 'unavailable' };
    }
  }
}

function targetPrecondition(
  workspace: WorkspaceDocument,
  id: string,
  expectation: 'active-investing' | 'active-non-investing',
): LocationWriteResult | undefined {
  if (id.length === 0) return undefined;
  const target = workspace.locations.find((location) => location.id === id);
  if (target === undefined) return { status: 'location-not-found' };
  const isInvesting = target.roles.includes('investing');
  const roleMatches = expectation === 'active-investing' ? isInvesting : !isInvesting;
  return target.archivedAt === undefined && roleMatches
    ? undefined
    : { status: 'stale-location' };
}

function selectInvestmentLocations(workspace: WorkspaceDocument): InvestmentLocationView[] {
  const draftScope = workspace.portfolio.draft?.scope;
  return workspace.locations
    .filter((location) => location.archivedAt === undefined
      && location.roles.includes('investing'))
    .map<InvestmentLocationView>((location) => {
      const hasApplied = workspace.portfolio.plans.some(({ scope }) => (
        scope.type === 'location' && scope.locationId === location.id
      ));
      const hasDraft = draftScope?.type === 'location' && draftScope.locationId === location.id;
      return {
        ...structuredClone(location),
        portfolioStatus: hasApplied
          ? (hasDraft ? 'applied-and-draft' : 'applied')
          : (hasDraft ? 'draft' : 'empty'),
      };
    })
    .sort((left, right) => normalizedCompare(left, right));
}

function normalizedCompare(left: FinancialLocation, right: FinancialLocation): number {
  const byName = normalizeLocationName(left.shortName).localeCompare(
    normalizeLocationName(right.shortName),
    'ko-KR',
    { numeric: true },
  );
  return byName === 0 ? left.id.localeCompare(right.id) : byName;
}

function commandFailure(
  result: Extract<LocationCommandResult, { ok: false }>,
): LocationWriteResult {
  return {
    status: result.reason,
    ...(result.referencedScopes === undefined
      ? {}
      : { referencedScopes: [...result.referencedScopes] }),
  };
}

function writeOutcome(
  result: WorkspaceWriteResult,
  locationId: string,
): LocationWriteResult {
  if (result.status !== 'saved') {
    if (result.status === 'conflict') return { status: 'conflict' };
    if (result.status === 'invalid') return { status: 'invalid-input' };
    return { status: 'unavailable' };
  }
  const location = result.workspace.locations.find(({ id }) => id === locationId);
  return location === undefined
    ? { status: 'unavailable' }
    : { status: 'saved', location: structuredClone(location) };
}
