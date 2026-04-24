/**
 * Individual Savings Flow (ISF) - Step 2: 배당 시뮬레이션 (Dividend Simulation)
 * v0.7.2
 * 
 * 파일 역할: Step 2에서 사용되는 공통 상수 정의 (Constants)
 */
export const MODEL_VERSION = 10;
export const STEP1_LOCAL_STORAGE_KEY = "isf-rebuild-v1";
export const SHARE_STATE_KEY = "my-dividend-simulation";
export const LEGACY_SHARE_STATE_KEY = "my-portfolio-flow";
export const SHARE_STATE_SCHEMA = 2;
export const HASH_STATE_PARAM = "s";
export const MAX_FINANCIAL_INCOME = 20000000;
export const DEFAULT_TAX_RATE = 0.154;
export const DEFAULT_INFLATION_RATE = 0.02;
export const MANUAL_BACKUP_WINDOW_MS = 60 * 1000;
export const TEMP_STORAGE_KEY = "isf-step2-draft-tmp";

export const ASSET_COLORS = ["#ea5b2a", "#1e8b7c", "#3175b6", "#d97706", "#7c3aed", "#e11d48", "#0f766e", "#64748b"];

