import { IsfUtils } from "../../../shared/core/utils.js";

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function createRepresentativeList(items) {
  const list = document.createElement("ul");
  list.className = "financial-summary-card__list";

  const safeItems = Array.isArray(items) && items.length > 0 ? items : ["대표 항목 없음"];
  safeItems.forEach((item) => {
    const row = document.createElement("li");
    row.textContent = item;
    list.appendChild(row);
  });
  return list;
}

function renderCard(card) {
  const isMetric = card.type === "metric";
  const button = document.createElement(isMetric ? "article" : "button");
  if (!isMetric) {
    button.type = "button";
    button.dataset.financialCategory = card.category;
    button.setAttribute("aria-label", `${card.label} 상세 열기`);
  } else {
    button.dataset.financialMetric = card.metric;
  }
  button.className = [
    "financial-summary-card",
    isMetric ? "financial-summary-card--metric" : "",
    `financial-summary-card--${card.tone || card.category}`,
  ].filter(Boolean).join(" ");

  const head = document.createElement("span");
  head.className = "financial-summary-card__head";
  head.appendChild(createTextElement("span", "financial-summary-card__label", card.label));
  if (!isMetric) {
    head.appendChild(createTextElement("span", "financial-summary-card__count", `${card.count}개`));
  }

  const total = createTextElement(
    "strong",
    "financial-summary-card__total",
    isMetric ? card.value : IsfUtils.formatMoney(card.total || 0),
  );
  const list = createRepresentativeList(card.representatives);

  button.appendChild(head);
  button.appendChild(total);
  button.appendChild(list);

  return button;
}

function renderGroup(group) {
  const section = document.createElement("section");
  section.className = "financial-summary-group";
  section.dataset.financialSummaryGroup = group.id;

  const grid = document.createElement("div");
  grid.className = "financial-summary-group__cards";
  if (group.title) {
    section.setAttribute("aria-label", group.title);
  }

  (group.cards || []).forEach((card) => {
    grid.appendChild(renderCard(card));
  });

  section.appendChild(grid);
  return section;
}

export function renderFinancialSummaryGroups(host, groups) {
  if (!host) return;
  host.classList.add("financial-summary-groups");
  host.replaceChildren(...(Array.isArray(groups) ? groups : []).map(renderGroup));
}
