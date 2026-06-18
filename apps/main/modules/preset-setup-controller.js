import { IsfUtils } from "../../../shared/core/utils.js";
import { dom } from "./dom.js";
import { getMonthlyIncomeTotalWon } from "./input-sanitizer.js";
import {
  PRESET_STYLES,
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
    if (dom.presetSetupStep) dom.presetSetupStep.hidden = false;
    if (dom.presetConfirmStep) dom.presetConfirmStep.hidden = true;
    if (dom.presetBackBtn) dom.presetBackBtn.hidden = true;
    if (dom.applyModalPresetBtn) dom.applyModalPresetBtn.textContent = "다음: 확인";
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
