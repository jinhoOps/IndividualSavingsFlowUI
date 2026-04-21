/**
 * Step 2 Constants
 */
export const MODEL_VERSION = 10;
export const UNALLOCATED_ASSET_KEY = "__unallocated__";
export const STEP1_LOCAL_STORAGE_KEY = "isf-rebuild-v1";
export const SHARE_STATE_KEY = "my-portfolio-flow";
export const SHARE_STATE_SCHEMA = 2;
export const HASH_STATE_PARAM = "s";
export const MAX_FINANCIAL_INCOME = 20000000;
export const DEFAULT_TAX_RATE = 0.154;
export const MANUAL_BACKUP_WINDOW_MS = 60 * 1000;
export const TEMP_STORAGE_KEY = "isf-step2-draft-tmp";

export const DEFAULT_ACCOUNT_TEMPLATES = [
  { name: "국내주식", accountWeight: 34, allocations: [{ key: "kr-samsung", label: "삼성전자", targetWeight: 40 }, { key: "kr-sk-hynix", label: "SK하이닉스", targetWeight: 35 }, { key: "kr-hyundai", label: "현대차", targetWeight: 25 }] },
  { name: "ISA", accountWeight: 33, allocations: [{ key: "fund-kospi", label: "코스피", targetWeight: 30 }, { key: "fund-nasdaq100", label: "나스닥100", targetWeight: 40 }, { key: "fund-dow-dividend", label: "미국배당다우존스", targetWeight: 30 }] },
  { name: "해외주식", accountWeight: 33, allocations: [{ key: "us-nasdaq100", label: "나스닥100", targetWeight: 60 }, { key: "us-tesla", label: "Tesla", targetWeight: 20 }, { key: "us-amd", label: "AMD", targetWeight: 20 }] }
];

export const FALLBACK_ALLOCATIONS = [{ key: "domestic-stock", label: "국내주식", targetWeight: 35 }, { key: "global-stock", label: "해외주식", targetWeight: 35 }, { key: "bond", label: "채권", targetWeight: 20 }, { key: "cash-like", label: "현금성", targetWeight: 10 }];
export const ASSET_COLORS = ["#ea5b2a", "#1e8b7c", "#3175b6", "#d97706", "#7c3aed", "#e11d48", "#0f766e", "#64748b"];
