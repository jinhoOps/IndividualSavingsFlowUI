import { SANKEY_VALUE_MODES, MONEY_UNIT } from "./constants.js";

const backupTimestampFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatCurrency(value) {
  return IsfUtils.formatMoney(value);
}

export function formatSignedCurrency(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  if (safeValue < 0) {
    return `-${IsfUtils.formatMoney(Math.abs(safeValue))}`;
  }
  return `+${IsfUtils.formatMoney(safeValue)}`;
}

export function formatPercent(percent) {
  const safe = Number.isFinite(percent) ? percent : 0;
  return `${IsfUtils.roundTo(safe, 1).toLocaleString("ko-KR")} %`;
}

export function formatMonthSpan(months) {
  const year = Math.floor(months / 12);
  const month = months % 12;

  if (year <= 0) {
    return `${month}개월`;
  }
  if (month === 0) {
    return `${year}년`;
  }
  return `${year}년 ${month}개월`;
}

export function formatSankeyDisplayValue(value, totalValue, valueMode = SANKEY_VALUE_MODES.AMOUNT) {
  const safeValue = Math.max(0, Number(value) || 0);
  if (valueMode === SANKEY_VALUE_MODES.PERCENT) {
    const safeTotal = Math.max(0, Number(totalValue) || 0);
    if (safeTotal <= 0) {
      return "0 %";
    }
    const percent = IsfUtils.roundTo((safeValue / safeTotal) * 100, 1);
    return `${percent.toLocaleString("ko-KR")} %`;
  }
  return formatCurrency(safeValue);
}

export function formatBackupTimestamp(dateText) {
  const parsed = Date.parse(String(dateText || ""));
  if (!Number.isFinite(parsed)) {
    return "-";
  }
  return backupTimestampFormatter.format(new Date(parsed));
}
