import { AccountMapState } from "./modules/state.js";
import { resolveLatestMainInputs } from "./modules/step1-connector.js";
import { buildAccountMapDraftFromMain } from "./modules/draft-builder.js";

function formatCount(value, label) {
  return `${Number(value) || 0}${label}`;
}

function createText(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

const AccountMapApp = {
  state: null,
  nodes: {},

  async init() {
    this.cacheNodes();
    this.state = new AccountMapState();

    try {
      await this.state.loadFromStorage();
      this.bindEvents();
      this.render();
    } catch (error) {
      console.error("[AccountMap] Initialization failed:", error);
      this.showFeedback("Account Map을 불러오지 못했습니다.");
    }
  },

  cacheNodes() {
    this.nodes = {
      importMainData: document.querySelector("#importMainData"),
      summary: document.querySelector("#accountMapSummary"),
      canvas: document.querySelector("#accountMapCanvas"),
      detail: document.querySelector("#accountMapDetail"),
      candidates: document.querySelector("#accountMapCandidates"),
      feedback: document.querySelector("#accountMapFeedback"),
    };
  },

  bindEvents() {
    this.nodes.importMainData?.addEventListener("click", async () => {
      await this.importMainData();
    });
  },

  async importMainData() {
    const latest = await resolveLatestMainInputs();
    if (!latest?.data) {
      this.showFeedback("가져올 Main 데이터가 없습니다.");
      return;
    }

    const draft = buildAccountMapDraftFromMain(latest.data, latest.source);
    await this.state.replaceDraft(draft);
    this.render();
    this.showFeedback("Main 데이터로 Account Map 초안을 만들었습니다.");
  },

  showFeedback(message) {
    if (!this.nodes.feedback) return;
    this.nodes.feedback.textContent = message;
    this.nodes.feedback.hidden = false;
  },

  render() {
    const draft = this.state?.data || {};
    this.renderSummary(draft);
    this.renderCanvas(draft);
    this.renderDetail(draft);
    this.renderCandidates(draft);
  },

  renderSummary(draft) {
    if (!this.nodes.summary) return;
    const summary = document.createDocumentFragment();
    summary.append(
      createText("span", "account-map-summary__item", formatCount(draft.accounts?.length, "개 계좌")),
      createText("span", "account-map-summary__item", formatCount(draft.relationships?.length, "개 관계")),
      createText("span", "account-map-summary__item", formatCount(draft.candidates?.length, "개 후보")),
    );
    this.nodes.summary.replaceChildren(summary);
  },

  renderCanvas(draft) {
    if (!this.nodes.canvas) return;
    if (!draft.accounts?.length) {
      const empty = document.createElement("div");
      empty.className = "account-map-empty";
      empty.append(
        createText("strong", "", "아직 Account Map 초안이 없습니다."),
        createText("span", "", "Main 데이터 가져오기로 계좌 관계 후보를 생성하세요."),
      );
      this.nodes.canvas.replaceChildren(empty);
      return;
    }

    const wrap = document.createElement("div");
    wrap.className = "account-map-graph";

    const accountList = document.createElement("ul");
    accountList.className = "account-map-node-list";
    draft.accounts.forEach((account) => {
      const item = document.createElement("li");
      item.dataset.accountId = account.id || "";
      item.textContent = account.name || account.id || "계좌";
      accountList.appendChild(item);
    });

    const relationshipList = document.createElement("ul");
    relationshipList.className = "account-map-relationship-list";
    draft.relationships.forEach((relationship) => {
      const item = document.createElement("li");
      item.dataset.relationshipId = relationship.id || "";
      const type = createText("span", "account-map-relationship-type", getRelationshipTypeLabel(relationship.type));
      const label = createText("strong", "", relationship.label || "관계");
      item.append(type, label);
      relationshipList.appendChild(item);
    });
    wrap.append(accountList, relationshipList);
    this.nodes.canvas.replaceChildren(wrap);
  },

  renderDetail() {
    if (!this.nodes.detail) return;
    this.nodes.detail.replaceChildren(createText("p", "hint", "계좌나 관계를 선택하면 금액, 결제일, 메모가 여기에 표시됩니다."));
  },

  renderCandidates(draft) {
    if (!this.nodes.candidates) return;
    if (!draft.candidates?.length) {
      this.nodes.candidates.replaceChildren(createText("p", "hint", "검토할 고정 결제 후보가 없습니다."));
      return;
    }

    const list = document.createElement("ul");
    list.className = "account-map-candidate-list";
    draft.candidates.forEach((candidate) => {
      const item = document.createElement("li");
      const label = createText("strong", "", candidate.label || candidate.id || "후보");
      const status = createText("span", "account-map-candidate-status", candidate.recommended ? "추천" : "검토 필요");
      item.append(label, status);
      list.appendChild(item);
    });
    this.nodes.candidates.replaceChildren(list);
  },
};

function getRelationshipTypeLabel(type) {
  const labels = {
    "income-deposit": "입금",
    "auto-transfer": "이체",
    "savings-transfer": "저축",
    "investment-transfer": "투자",
  };
  return labels[type] || "관계";
}

document.addEventListener("DOMContentLoaded", () => AccountMapApp.init());
