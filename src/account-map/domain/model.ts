export const SYSTEM_PURPOSE_IDS = [
  'system:income',
  'system:housing',
  'system:living',
  'system:saving',
  'system:investing',
] as const;

export const ACCOUNT_MAP_APPLIED_SCHEMA_VERSION = 2 as const;
export const ACCOUNT_MAP_APPLIED_V3_SCHEMA_VERSION = 3 as const;
export const ACCOUNT_MAP_DRAFT_V2_SCHEMA_VERSION = 2 as const;

export type SystemPurposeId = (typeof SYSTEM_PURPOSE_IDS)[number];
export type OutflowPurposeId = Exclude<SystemPurposeId, 'system:income'>;
export type PurposeId = SystemPurposeId | `custom:${string}`;

export interface CustomPurpose {
  id: `custom:${string}`;
  parentId: OutflowPurposeId;
  name: string;
  targetMonthlyWon: number;
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;
}

interface PurposeLocationLinkBase {
  id: string;
  purposeId: PurposeId;
  locationId: string;
  monthlyAmountWon: number;
  createdAt: number;
  updatedAt: number;
}

export type PurposeLocationLink =
  | (PurposeLocationLinkBase & {
      remainder: boolean;
      status: 'active';
    })
  | (PurposeLocationLinkBase & {
      remainder: false;
      status: 'suspended';
      suspendedReason: 'location-archived' | 'user';
    });

export interface AccountMapApplied {
  schemaVersion: typeof ACCOUNT_MAP_APPLIED_SCHEMA_VERSION;
  sourceMainUpdatedAt: number;
  customPurposes: CustomPurpose[];
  links: PurposeLocationLink[];
  setupCompletedAt: number;
  updatedAt: number;
}

export interface AccountMapDraft {
  schemaVersion: 1;
  sourceMainUpdatedAt: number;
  customPurposes: CustomPurpose[];
  links: PurposeLocationLink[];
  step: 'connect' | 'review';
  updatedAt: number;
}

export type AccountTransferAllocation =
  | { kind: 'fixed'; monthlyAmountWon: number }
  | { kind: 'sweep' };

type AccountTransferBase = {
  id: string;
  sourceLocationId: string;
  targetLocationId: string;
  allocation: AccountTransferAllocation;
  createdAt: number;
  updatedAt: number;
};

export type AccountTransferLink =
  | (AccountTransferBase & { status: 'active' })
  | (AccountTransferBase & {
      status: 'suspended';
      suspendedReason: 'location-archived' | 'user';
    });

export type AccountMapSetupStep = 'basis' | 'locations' | 'transfers' | 'review';

export interface AccountMapAppliedV3 {
  schemaVersion: typeof ACCOUNT_MAP_APPLIED_V3_SCHEMA_VERSION;
  sourceMainUpdatedAt: number;
  customPurposes: CustomPurpose[];
  links: PurposeLocationLink[];
  transfers: AccountTransferLink[];
  setupCompletedAt: number;
  updatedAt: number;
}

export interface AccountMapDraftV2 {
  schemaVersion: typeof ACCOUNT_MAP_DRAFT_V2_SCHEMA_VERSION;
  sourceMainUpdatedAt: number;
  customPurposes: CustomPurpose[];
  links: PurposeLocationLink[];
  transfers: AccountTransferLink[];
  step: AccountMapSetupStep;
  updatedAt: number;
}

export type StoredAccountMapApplied = AccountMapApplied | AccountMapAppliedV3;
export type StoredAccountMapDraft = AccountMapDraft | AccountMapDraftV2;
