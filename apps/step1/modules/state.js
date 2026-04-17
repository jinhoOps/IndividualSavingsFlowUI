import {
  DEFAULT_INPUTS,
  SHARE_STATE_KEY,
  HASH_STATE_PARAM,
  SANKEY_VALUE_MODES,
  SANKEY_SORT_MODES,
  ITEM_SORT_MODES
} from "./constants.js";
import { sanitizeInputs } from "./input-sanitizer.js";
import { loadPersistedInputs } from "./storage-manager.js";

function resolveInitialInputs() {
  const sid = IsfShare.getShareIdFromUrl();
  const hashInputs = IsfShare.decodePayloadFromHash(
    new URLSearchParams(window.location.hash.replace(/^#/, "")).get(HASH_STATE_PARAM),
    SHARE_STATE_KEY
  );
  
  if (hashInputs) {
    return sanitizeInputs({ ...DEFAULT_INPUTS, ...hashInputs });
  }
  if (sid && IsfShare.detectViewMode()) {
    return sanitizeInputs({ ...DEFAULT_INPUTS });
  }
  return sanitizeInputs({ ...DEFAULT_INPUTS, ...loadPersistedInputs() });
}

export const state = {
  isViewMode: IsfShare.detectViewMode(),
  inputs: resolveInitialInputs(),
  backupEntries: [],
  backupStoreReady: false,
  backupStoreError: false,
  draftInputs: null,
  applyFeedbackTimer: null,
  suspendInputTracking: false,
  isApplyingHashState: false,
  sankeyValueMode: SANKEY_VALUE_MODES.AMOUNT,
  sankeySortMode: SANKEY_SORT_MODES.GROUP,
  sankeyZoom: 1,
  activeAdvancedTab: "expense",
  itemSortModes: {
    expense: ITEM_SORT_MODES.DEFAULT,
    savings: ITEM_SORT_MODES.DEFAULT,
    invest: ITEM_SORT_MODES.DEFAULT,
  },
  itemEditors: {
    income: { active: false, items: [], baselineSignature: "" },
    expense: { active: false, items: [], baselineSignature: "" },
    savings: { active: false, items: [], baselineSignature: "" },
    invest: { active: false, items: [], baselineSignature: "" },
  },
  snapshot: null,
  mobileInputsCollapsed: false,
  isDashboardMode: false,
  viewModeGuideClosedTemporarily: false,
  pwaVersionLastCheckedAt: 0,
};
