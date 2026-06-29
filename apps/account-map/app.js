import { AccountMapState } from "./modules/state.js";

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
    this.nodes.importMainData?.addEventListener("click", () => {
      this.showFeedback("Main 데이터 가져오기는 다음 작업에서 연결됩니다.");
    });
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

    const list = document.createElement("ul");
    list.className = "account-map-node-list";
    draft.accounts.forEach((account) => {
      const item = document.createElement("li");
      item.textContent = account.name || account.id || "계좌";
      list.appendChild(item);
    });
    this.nodes.canvas.replaceChildren(list);
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
      item.textContent = candidate.label || candidate.id || "후보";
      list.appendChild(item);
    });
    this.nodes.candidates.replaceChildren(list);
  },
};

document.addEventListener("DOMContentLoaded", () => AccountMapApp.init());
