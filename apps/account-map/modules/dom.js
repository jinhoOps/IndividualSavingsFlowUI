import { getRelationshipTypeMeta } from "./map-renderer.js";

export function createText(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

export function formatWon(value) {
  const amount = Number(value) || 0;
  return `${amount.toLocaleString("ko-KR")}원`;
}

export function renderSummary(host, draft = {}) {
  if (!host) return;
  const accounts = Array.isArray(draft.accounts) ? draft.accounts.length : 0;
  const relationships = Array.isArray(draft.relationships) ? draft.relationships.length : 0;
  const candidates = Array.isArray(draft.candidates) ? draft.candidates.length : 0;
  const items = [
    `${accounts}개 계좌`,
    `${relationships}개 관계`,
    `${candidates}개 확인 필요`,
  ].map((text) => createText("span", "account-map-summary__item", text));
  host.replaceChildren(...items);
}

function relationshipSourceText(sourceRef) {
  if (!sourceRef || typeof sourceRef !== "object") return "Account Map 초안";
  return `${sourceRef.collection || "source"}:${sourceRef.id || "unknown"}`;
}

function createField(label, value) {
  const row = document.createElement("div");
  row.className = "account-map-detail-field";
  row.append(
    createText("span", "account-map-detail-field__label", label),
    createText("strong", "account-map-detail-field__value", value || "-"),
  );
  return row;
}

function parseSelectedId(selectedId) {
  const separatorIndex = selectedId.indexOf(":");
  if (separatorIndex < 0) return { kind: "", id: "" };
  return {
    kind: selectedId.slice(0, separatorIndex),
    id: selectedId.slice(separatorIndex + 1),
  };
}

export function renderDetail(host, draft = {}) {
  if (!host) return;
  const selectedId = String(draft.selectedId || "");
  if (!selectedId) {
    host.replaceChildren(createText("p", "hint", "계좌나 관계를 선택하면 금액, 결제일, 메모가 여기에 표시됩니다."));
    return;
  }

  const { kind, id } = parseSelectedId(selectedId);
  if (kind === "relationship") {
    const relationship = (draft.relationships || []).find((item) => item.id === id);
    if (!relationship) {
      host.replaceChildren(createText("p", "hint", "선택한 관계를 찾을 수 없습니다."));
      return;
    }
    const meta = getRelationshipTypeMeta(relationship.type);
    const form = document.createElement("div");
    form.className = "account-map-detail-card";
    form.dataset.relationshipEditor = relationship.id;
    form.append(
      createText("span", "account-map-detail-chip", meta.label),
      createText("h3", "", relationship.label || "관계"),
      createField("월 금액", formatWon(relationship.amount)),
      createField("유형", relationship.type || "relationship"),
      createField("신뢰도", relationship.confidence || "needs-confirmation"),
      createField("출처", relationshipSourceText(relationship.sourceRef)),
    );

    const paymentLabel = createText("label", "account-map-editor-label", "결제일");
    const paymentInput = document.createElement("input");
    paymentInput.type = "text";
    paymentInput.name = "paymentDay";
    paymentInput.value = relationship.paymentDay || "";
    paymentInput.placeholder = "예: 25일";
    paymentInput.dataset.relationshipField = "paymentDay";
    paymentLabel.appendChild(paymentInput);

    const memoLabel = createText("label", "account-map-editor-label", "메모");
    const memoInput = document.createElement("textarea");
    memoInput.name = "memo";
    memoInput.rows = 3;
    memoInput.value = relationship.memo || "";
    memoInput.placeholder = "관계 메모";
    memoInput.dataset.relationshipField = "memo";
    memoLabel.appendChild(memoInput);

    form.append(paymentLabel, memoLabel);
    host.replaceChildren(form);
    return;
  }

  if (kind === "account") {
    const account = (draft.accounts || []).find((item) => item.id === id) || { id, name: id };
    const incoming = (draft.relationships || []).filter((relationship) => relationship.targetAccountId === id);
    const outgoing = (draft.relationships || []).filter((relationship) => relationship.sourceAccountId === id);
    const card = document.createElement("div");
    card.className = "account-map-detail-card";
    card.append(
      createText("h3", "", account.name || account.id || "계좌"),
      createField("들어오는 관계", `${incoming.length}개`),
      createField("나가는 관계", `${outgoing.length}개`),
    );

    const list = document.createElement("ul");
    list.className = "account-map-linked-list";
    [...incoming, ...outgoing].forEach((relationship) => {
      const item = document.createElement("li");
      const meta = getRelationshipTypeMeta(relationship.type);
      item.append(
        createText("span", "account-map-detail-chip", meta.label),
        createText("strong", "", relationship.label || relationship.id || "관계"),
      );
      list.appendChild(item);
    });
    if (!list.children.length) {
      list.appendChild(createText("li", "hint", "연결된 관계가 없습니다."));
    }
    card.appendChild(list);
    host.replaceChildren(card);
    return;
  }

  host.replaceChildren(createText("p", "hint", "선택 항목을 표시할 수 없습니다."));
}

export function renderCandidates(host, candidates = []) {
  if (!host) return;
  if (!Array.isArray(candidates) || !candidates.length) {
    host.replaceChildren(createText("p", "hint", "검토할 고정 결제 후보가 없습니다."));
    return;
  }

  const list = document.createElement("ul");
  list.className = "account-map-candidate-list";
  candidates.forEach((candidate) => {
    const item = document.createElement("li");
    item.dataset.candidateId = candidate.id || "";
    const body = document.createElement("div");
    body.className = "account-map-candidate-body";
    body.append(
      createText("strong", "", candidate.label || candidate.id || "후보"),
      createText("span", "", candidate.reason || (candidate.recommended ? "추천 후보" : "검토 필요")),
    );
    const status = createText("span", "account-map-candidate-status", candidate.recommended ? "추천" : "검토 필요");
    const actions = document.createElement("div");
    actions.className = "account-map-candidate-actions";
    const accept = document.createElement("button");
    accept.type = "button";
    accept.className = "btn btn-primary btn-sm";
    accept.dataset.candidateAction = "accept";
    accept.dataset.candidateId = candidate.id || "";
    accept.textContent = "수락";
    const exclude = document.createElement("button");
    exclude.type = "button";
    exclude.className = "btn btn-ghost btn-sm";
    exclude.dataset.candidateAction = "exclude";
    exclude.dataset.candidateId = candidate.id || "";
    exclude.textContent = "제외";
    actions.append(accept, exclude);
    item.append(body, status, actions);
    list.appendChild(item);
  });
  host.replaceChildren(list);
}
