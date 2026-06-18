import { IsfUtils } from "../../../shared/core/utils.js";
import { dom } from "./dom.js";
import { getMonthlyIncomeTotalWon } from "./input-sanitizer.js";
import {
  PRESET_STYLES,
  applyPresetPreview,
  buildPresetPreview,
  normalizePresetPercentages,
} from "./presets.js";

const PERCENT_KEYS = ["expense", "savings", "invest"];

function formatPercent(value) {
  const rounded = Math.round(Number(value || 0) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function getCorrectionMode() {
  const checked = Array.from(dom.presetCorrectionModeInputs || []).find((input) => input.checked);
  return checked?.value === "percentage" ? "percentage" : "amount";
}

function readPercentages() {
  const values = {};
  Array.from(dom.presetPercentInputs || []).forEach((input) => {
    values[input.dataset.presetPercent] = Number(input.value || 0);
  });
  return values;
}

function writePercentages(percentages) {
  Array.from(dom.presetPercentInputs || []).forEach((input) => {
    const key = input.dataset.presetPercent;
    input.value = formatPercent(percentages[key]);
  });
}

function setActivePreset(key) {
  Array.from(dom.presetSegmentBtns || []).forEach((button) => {
    const active = button.dataset.presetKey === key;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function clearChildren(node) {
  if (node) node.replaceChildren();
}

function appendPreviewRow(container, label, amount, percent) {
  const row = document.createElement("div");
  row.className = "preset-preview-row";

  const name = document.createElement("span");
  name.textContent = label;

  const meta = document.createElement("span");
  meta.textContent = `${formatPercent(percent)}% · ${IsfUtils.convertToKoreanWon(amount)}`;

  row.append(name, meta);
  container.append(row);
}

function appendConfirmRow(container, item, typeLabel) {
  const row = document.createElement("div");
  row.className = "preset-confirm-row";

  const title = document.createElement("div");
  title.className = "preset-confirm-row__title";
  const name = document.createElement("strong");
  name.textContent = item.name;
  const group = document.createElement("span");
  group.textContent = `${typeLabel} · ${item.group || "기본"}`;
  title.append(name, group);

  const metrics = document.createElement("div");
  metrics.className = "preset-confirm-row__metrics";

  if (item.correctionDelta === 0) {
    const percent = document.createElement("span");
    percent.textContent = `${formatPercent(item.normalizedPercent)}%`;
    const amount = document.createElement("span");
    amount.textContent = IsfUtils.convertToKoreanWon(item.amount);
    metrics.append(percent, amount);
  } else {
    const original = document.createElement("span");
    original.textContent = `원래 ${formatPercent(item.originalPercent)}%`;
    const normalized = document.createElement("span");
    normalized.textContent = `보정 ${formatPercent(item.normalizedPercent)}%`;
    const amount = document.createElement("span");
    amount.textContent = IsfUtils.convertToKoreanWon(item.amount);
    const delta = document.createElement("span");
    delta.textContent = `차이 ${IsfUtils.convertToKoreanWon(item.correctionDelta)}`;
    metrics.append(original, normalized, amount, delta);
  }

  row.append(title, metrics);
  container.append(row);
}

export function createPresetSetupController({ persistence, getInputs }) {
  let selectedPresetKey = "balanced";
  let lastPresetPercentages = { ...PRESET_STYLES.balanced.percentages };
  let draftPreview = null;

  function getMonthlyIncome() {
    const explicit = IsfUtils.toWon(dom.presetMonthlyIncome?.value || "");
    if (explicit > 0) return explicit;
    const currentInputs = typeof getInputs === "function" ? getInputs() : null;
    return getMonthlyIncomeTotalWon(currentInputs?.incomes || []) || 3000000;
  }

  function renderPreview() {
    const percentages = readPercentages();
    draftPreview = buildPresetPreview({
      monthlyIncomeWon: getMonthlyIncome(),
      presetKey: selectedPresetKey,
      percentages,
      correctionMode: getCorrectionMode(),
    });

    if (dom.presetPercentTotal) {
      dom.presetPercentTotal.textContent = `${formatPercent(draftPreview.percentages.normalizedTotal)}%`;
    }
    if (dom.presetPreviewTotal) {
      const total =
        draftPreview.totals.expenseAmount +
        draftPreview.totals.savingsAmount +
        draftPreview.totals.investAmount;
      dom.presetPreviewTotal.textContent = IsfUtils.convertToKoreanWon(total);
    }

    clearChildren(dom.presetPreviewRows);
    if (dom.presetPreviewRows) {
      appendPreviewRow(dom.presetPreviewRows, "지출", draftPreview.totals.expenseAmount, draftPreview.percentages.normalized.expense);
      appendPreviewRow(dom.presetPreviewRows, "저축", draftPreview.totals.savingsAmount, draftPreview.percentages.normalized.savings);
      appendPreviewRow(dom.presetPreviewRows, "투자", draftPreview.totals.investAmount, draftPreview.percentages.normalized.invest);
    }
  }

  function normalizeDraftPercentages() {
    const normalized = normalizePresetPercentages(readPercentages());
    writePercentages(normalized.normalized);
    lastPresetPercentages = { ...normalized.normalized };
    renderPreview();
  }

  function renderConfirmation() {
    if (!dom.presetConfirmStep || !draftPreview) return;
    dom.presetConfirmStep.replaceChildren();

    const warning = document.createElement("div");
    warning.className = "preset-overwrite-warning";
    warning.textContent = "기존 데이터 덮어쓰기: 확인을 누르면 현재 Step 1 지출, 저축, 투자 행이 프리셋 결과로 교체됩니다.";

    const summary = document.createElement("div");
    summary.className = "preset-confirm-summary";
    const summaryTitle = document.createElement("strong");
    summaryTitle.textContent = `${draftPreview.presetLabel} 프리셋`;
    const summaryText = document.createElement("span");
    summaryText.textContent =
      `월수입 ${IsfUtils.convertToKoreanWon(draftPreview.totals.monthlyIncomeWon)} 기준`;
    summary.append(summaryTitle, summaryText);

    const rows = document.createElement("div");
    rows.className = "preset-confirm-rows";
    draftPreview.expenseItems.forEach((item) => appendConfirmRow(rows, item, "지출"));
    draftPreview.savingsItems.forEach((item) => appendConfirmRow(rows, item, "저축"));
    draftPreview.investItems.forEach((item) => appendConfirmRow(rows, item, "투자"));

    dom.presetConfirmStep.append(warning, summary, rows);
  }

  function showSetupStep() {
    if (dom.presetSetupStep) dom.presetSetupStep.hidden = false;
    if (dom.presetConfirmStep) dom.presetConfirmStep.hidden = true;
    if (dom.presetBackBtn) dom.presetBackBtn.hidden = true;
    if (dom.applyModalPresetBtn) dom.applyModalPresetBtn.textContent = "다음: 확인";
  }

  function showConfirmStep() {
    renderPreview();
    renderConfirmation();
    if (dom.presetSetupStep) dom.presetSetupStep.hidden = true;
    if (dom.presetConfirmStep) dom.presetConfirmStep.hidden = false;
    if (dom.presetBackBtn) dom.presetBackBtn.hidden = false;
    if (dom.applyModalPresetBtn) dom.applyModalPresetBtn.textContent = "적용하기";
  }

  function commitPreview() {
    if (!draftPreview || !persistence || typeof persistence.commitImmediateInputs !== "function") return;
    persistence.commitImmediateInputs(applyPresetPreview(draftPreview));
    close();
    if (window.IsfFeedback && dom.applyFeedback) {
      window.IsfFeedback.showFeedback(dom.applyFeedback, "프리셋 설정이 적용되었습니다. 생성된 항목을 확인해보세요.");
    }
  }

  function choosePreset(key) {
    selectedPresetKey = PRESET_STYLES[key] ? key : "balanced";
    setActivePreset(selectedPresetKey);
    if (selectedPresetKey === "custom") {
      writePercentages(lastPresetPercentages);
    } else {
      const next = { ...PRESET_STYLES[selectedPresetKey].percentages };
      lastPresetPercentages = { ...next };
      writePercentages(next);
    }
    renderPreview();
  }

  function open() {
    if (!dom.presetModal) return;
    const currentIncome = getMonthlyIncome();
    if (dom.presetMonthlyIncome) {
      dom.presetMonthlyIncome.value = IsfUtils.formatWonInputValue(String(currentIncome));
    }
    showSetupStep();
    choosePreset(selectedPresetKey);
    dom.presetModal.hidden = false;
    window.setTimeout(() => {
      dom.presetModal.classList.add("is-active");
      IsfUtils.updateAllKoreanWonHints(dom.presetModal);
    }, 10);
  }

  function close() {
    if (!dom.presetModal) return;
    dom.presetModal.classList.remove("is-active");
    window.setTimeout(() => {
      dom.presetModal.hidden = true;
    }, 250);
  }

  function bind() {
    if (dom.openPresetBtn) dom.openPresetBtn.addEventListener("click", open);
    if (dom.closePresetBtn) dom.closePresetBtn.addEventListener("click", close);
    if (dom.closePresetModalCancel) dom.closePresetModalCancel.addEventListener("click", close);
    if (dom.presetBackBtn) dom.presetBackBtn.addEventListener("click", showSetupStep);
    if (dom.applyModalPresetBtn) {
      dom.applyModalPresetBtn.addEventListener("click", () => {
        if (dom.presetSetupStep && !dom.presetSetupStep.hidden) {
          showConfirmStep();
          return;
        }
        commitPreview();
      });
    }
    Array.from(dom.presetSegmentBtns || []).forEach((button) => {
      button.addEventListener("click", () => choosePreset(button.dataset.presetKey));
    });
    Array.from(dom.presetPercentInputs || []).forEach((input) => {
      input.addEventListener("input", renderPreview);
      input.addEventListener("blur", normalizeDraftPercentages);
    });
    Array.from(dom.presetCorrectionModeInputs || []).forEach((input) => {
      input.addEventListener("change", renderPreview);
    });
    if (dom.presetMonthlyIncome) {
      dom.presetMonthlyIncome.addEventListener("input", renderPreview);
      dom.presetMonthlyIncome.addEventListener("blur", () => {
        dom.presetMonthlyIncome.value = IsfUtils.formatWonInputValue(dom.presetMonthlyIncome.value);
        renderPreview();
      });
    }
  }

  return {
    bind,
    open,
    close,
    getPreview: () => draftPreview,
    persistence,
  };
}
