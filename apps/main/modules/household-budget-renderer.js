function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function renderMetric(metric) {
  const item = document.createElement("article");
  item.className = "household-budget-metric";
  item.appendChild(createTextElement("span", "household-budget-metric__label", metric.label));
  item.appendChild(createTextElement("strong", "household-budget-metric__value", metric.value));
  return item;
}

export function renderHouseholdBudgetPanel(host, summary) {
  if (!host) return;

  const panel = document.createElement("section");
  panel.className = "household-budget-panel";
  panel.setAttribute("aria-label", "신혼부부 예산");

  const head = document.createElement("div");
  head.className = "household-budget-panel__head";

  const titleGroup = document.createElement("div");
  titleGroup.className = "household-budget-panel__title-group";
  titleGroup.appendChild(createTextElement("h3", "household-budget-panel__title", "신혼부부 예산"));
  titleGroup.appendChild(createTextElement("p", "household-budget-panel__note", summary?.projectionNote || ""));

  const status = createTextElement("span", "household-budget-status", summary?.status || "여유");
  status.dataset.householdBudgetStatus = summary?.status || "여유";

  const openButton = document.createElement("button");
  openButton.id = "openHouseholdBudgetModal";
  openButton.type = "button";
  openButton.className = "household-budget-panel__cta";
  openButton.dataset.householdBudgetAction = "open";
  openButton.textContent = "예산 상세 편집";

  head.appendChild(titleGroup);
  head.appendChild(status);
  head.appendChild(openButton);

  const metrics = document.createElement("div");
  metrics.className = "household-budget-panel__metrics";
  (Array.isArray(summary?.metrics) ? summary.metrics : []).slice(0, 3).forEach((metric) => {
    metrics.appendChild(renderMetric(metric));
  });

  panel.appendChild(head);
  panel.appendChild(metrics);
  host.replaceChildren(panel);
}
