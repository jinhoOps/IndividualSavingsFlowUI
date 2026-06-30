import { AccountMapState } from "./modules/state.js";
import { resolveLatestMainInputs } from "./modules/step1-connector.js";
import { buildAccountMapDraftFromMain } from "./modules/draft-builder.js";
import { renderAccountMap } from "./modules/map-renderer.js";
import { createText, renderCandidates, renderDetail, renderSummary } from "./modules/dom.js";

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
      autoLayoutMap: document.querySelector("#autoLayoutMap"),
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
    this.nodes.autoLayoutMap?.addEventListener("click", async () => {
      await this.state.resetNodePositions();
      this.render();
      this.showFeedback("Account Map을 자동정렬했습니다.");
    });

    this.nodes.canvas?.addEventListener("click", (event) => {
      this.handleMapSelection(event.target);
    });
    this.nodes.canvas?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      this.handleMapSelection(event.target);
      event.preventDefault();
    });
    this.nodes.candidates?.addEventListener("click", async (event) => {
      const button = event.target?.closest?.("[data-candidate-action]");
      if (!button) return;
      const candidateId = button.dataset.candidateId || "";
      try {
        if (button.dataset.candidateAction === "accept") {
          await this.state.acceptCandidate(candidateId);
          this.showFeedback("고정 결제 후보를 관계로 수락했습니다.");
        } else {
          await this.state.excludeCandidate(candidateId);
          this.showFeedback("고정 결제 후보를 제외했습니다.");
        }
      } catch (error) {
        console.error("[AccountMap] Save failed:", error);
        await this.state.loadFromStorage();
        this.showFeedback("Account Map 변경을 저장하지 못했습니다.");
      }
      this.render();
    });
    this.nodes.detail?.addEventListener("input", async (event) => {
      const field = event.target?.dataset?.relationshipField;
      if (!field) return;
      const editor = event.target.closest("[data-relationship-editor]");
      const relationshipId = editor?.dataset?.relationshipEditor || "";
      try {
        await this.state.updateRelationship(relationshipId, { [field]: event.target.value });
        this.renderSummary(this.state.data);
      } catch (error) {
        console.error("[AccountMap] Relationship save failed:", error);
        await this.state.loadFromStorage();
        this.render();
        this.showFeedback("Account Map 변경을 저장하지 못했습니다.");
      }
    });
  },

  async importMainData() {
    const latest = await resolveLatestMainInputs();
    if (!latest?.data) {
      this.showFeedback("가져올 Main 데이터가 없습니다.");
      return;
    }

    try {
      const draft = buildAccountMapDraftFromMain(latest.data, latest.source);
      await this.state.replaceDraft(draft);
      this.render();
      this.showFeedback("Main 데이터로 Account Map 초안을 만들었습니다.");
    } catch (error) {
      console.error("[AccountMap] Import save failed:", error);
      this.showFeedback("Account Map 초안을 저장하지 못했습니다.");
    }
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
    renderSummary(this.nodes.summary, draft);
  },

  renderCanvas(draft) {
    renderAccountMap(this.nodes.canvas, draft, {
      selectedId: draft.selectedId,
      positions: draft.positions,
      onNodePositionChange: async (nodeId, position) => {
        try {
          await this.state.setNodePosition(nodeId, position);
        } catch (error) {
          console.error("[AccountMap] Position save failed:", error);
          this.showFeedback("Account Map 위치를 저장하지 못했습니다.");
        }
      },
    });
  },

  renderDetail(draft) {
    renderDetail(this.nodes.detail, draft);
  },

  renderCandidates(draft) {
    renderCandidates(this.nodes.candidates, draft.candidates);
  },

  handleMapSelection(target) {
    const selectable = target?.closest?.("[data-account-map-select]");
    if (!selectable) return;
    const type = selectable.dataset.accountMapSelect;
    const id = type === "relationship" ? selectable.dataset.relationshipId : selectable.dataset.accountId;
    if (!id) return;
    this.state.setSelectedId(`${type}:${id}`);
    this.render();
  },
};

document.addEventListener("DOMContentLoaded", () => AccountMapApp.init());
