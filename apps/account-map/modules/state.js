export const ACCOUNT_MAP_STORAGE_KEY = "isf-account-map-v1";

export function createEmptyAccountMapDraft() {
  return {
    schemaVersion: 1,
    source: null,
    accounts: [],
    relationships: [],
    candidates: [],
    positions: {},
    selectedId: "",
    lastUpdated: new Date().toISOString(),
  };
}

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
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
      positions: saved.positions && typeof saved.positions === "object" ? saved.positions : {},
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

  async setNodePosition(nodeId, position) {
    const id = cleanText(nodeId);
    const x = Number(position?.x);
    const y = Number(position?.y);
    if (!id || !Number.isFinite(x) || !Number.isFinite(y)) return;
    this.data.positions = {
      ...(this.data.positions && typeof this.data.positions === "object" ? this.data.positions : {}),
      [id]: { x, y },
    };
    await this.saveToStorage();
  }

  async resetNodePositions() {
    this.data.positions = {};
    await this.saveToStorage();
  }

  async acceptCandidate(candidateId) {
    const candidate = this.data.candidates.find((item) => item.id === candidateId);
    if (!candidate) return null;
    const targetAccountId = `payee-${cleanText(candidate.sourceRef?.id || candidate.id, "candidate")}`;
    if (!this.data.accounts.some((account) => account.id === targetAccountId)) {
      this.data.accounts.push({
        id: targetAccountId,
        name: cleanText(candidate.label, "고정 결제처"),
        role: "payment",
        sourceAccountId: targetAccountId,
      });
    }

    const relationship = {
      id: `rel-candidate-${cleanText(candidate.sourceRef?.id || candidate.id, "candidate")}`,
      type: inferCandidateRelationshipType(candidate),
      sourceAccountId: cleanText(candidate.accountId, "acc-living"),
      targetAccountId,
      label: cleanText(candidate.label, "고정 결제"),
      amount: Number(candidate.amount) || 0,
      paymentDay: cleanText(candidate.paymentDay),
      memo: cleanText(candidate.memo),
      confidence: candidate.confidence || "needs-confirmation",
      sourceRef: candidate.sourceRef || { collection: "candidates", id: candidate.id },
    };
    this.data.relationships = [
      ...this.data.relationships.filter((item) => item.id !== relationship.id),
      relationship,
    ];
    this.data.candidates = this.data.candidates.filter((item) => item.id !== candidateId);
    this.data.selectedId = `relationship:${relationship.id}`;
    await this.saveToStorage();
    return relationship;
  }

  async excludeCandidate(candidateId) {
    this.data.candidates = this.data.candidates.filter((item) => item.id !== candidateId);
    await this.saveToStorage();
  }

  async updateRelationship(relationshipId, patch) {
    this.data.relationships = this.data.relationships.map((relationship) => {
      if (relationship.id !== relationshipId) return relationship;
      return {
        ...relationship,
        paymentDay: patch.paymentDay !== undefined ? cleanText(patch.paymentDay) : relationship.paymentDay,
        memo: patch.memo !== undefined ? cleanText(patch.memo) : relationship.memo,
      };
    });
    await this.saveToStorage();
  }

  async saveToStorage() {
    this.data.lastUpdated = new Date().toISOString();
    saveLocalDraft(this.data);
  }
}

function inferCandidateRelationshipType(candidate) {
  const text = `${candidate?.label || ""} ${candidate?.reason || ""}`;
  if (text.includes("카드")) return "card-payment";
  if (text.includes("대출") || text.includes("보험") || text.includes("렌탈")) return "loan-payment";
  return "utility-payment";
}
