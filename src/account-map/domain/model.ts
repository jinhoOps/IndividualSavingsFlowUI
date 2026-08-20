export const SYSTEM_PURPOSE_IDS = [
  'system:income',
  'system:housing',
  'system:living',
  'system:saving',
  'system:investing',
] as const;

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
  schemaVersion: 1;
  sourceMainUpdatedAt: number;
  customPurposes: CustomPurpose[];
  links: PurposeLocationLink[];
  layout: 'purpose' | 'account';
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
