export const ACCOUNT_MAP_STORAGE_KEY = "isf-account-map-v1";

export function createEmptyAccountMapDraft() {
  return {
    schemaVersion: 1,
    source: null,
    accounts: [],
    relationships: [],
    candidates: [],
    selectedId: "",
    lastUpdated: new Date().toISOString(),
  };
}

function getStorageHub() {
  return window.IsfStorageHub || window.IsfHubStorage || null;
}

function loadLocalDraft() {
  try {
    const hub = getStorageHub();
    const saved = hub?.loadLocal?.(ACCOUNT_MAP_STORAGE_KEY);
    if (saved) return saved;
  } catch (_error) {}

  try {
    const raw = localStorage.getItem(ACCOUNT_MAP_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
}

function saveLocalDraft(data) {
  try {
    const hub = getStorageHub();
    if (hub?.saveLocal) {
      hub.saveLocal(ACCOUNT_MAP_STORAGE_KEY, data);
      return;
    }
  } catch (_error) {}

  localStorage.setItem(ACCOUNT_MAP_STORAGE_KEY, JSON.stringify(data));
}

export class AccountMapState {
  constructor() {
    this.data = createEmptyAccountMapDraft();
  }

  async loadFromStorage() {
    const saved = loadLocalDraft();
    if (!saved || typeof saved !== "object") {
      this.data = createEmptyAccountMapDraft();
      return;
    }

    this.data = {
      ...createEmptyAccountMapDraft(),
      ...saved,
      accounts: Array.isArray(saved.accounts) ? saved.accounts : [],
      relationships: Array.isArray(saved.relationships) ? saved.relationships : [],
      candidates: Array.isArray(saved.candidates) ? saved.candidates : [],
      selectedId: typeof saved.selectedId === "string" ? saved.selectedId : "",
      lastUpdated: saved.lastUpdated || new Date().toISOString(),
    };
  }

  async replaceDraft(draft) {
    this.data = {
      ...createEmptyAccountMapDraft(),
      ...(draft && typeof draft === "object" ? draft : {}),
      lastUpdated: new Date().toISOString(),
    };
    await this.saveToStorage();
  }

  setSelectedId(selectedId) {
    this.data.selectedId = typeof selectedId === "string" ? selectedId : "";
    this.data.lastUpdated = new Date().toISOString();
    saveLocalDraft(this.data);
  }

  async saveToStorage() {
    this.data.lastUpdated = new Date().toISOString();
    saveLocalDraft(this.data);
  }
}
