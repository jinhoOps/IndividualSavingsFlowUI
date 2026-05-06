export const IsfUtils = (function initIsfUtils(global) {
  "use strict";

  const backupTimestampFormatter = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  function formatMoney(value) {
    const numericValue = Number(value || 0);
    if (!Number.isFinite(numericValue)) {
      return "0 만원";
    }
    const manValue = Math.round(numericValue / 10000);
    
    if (manValue >= 10000) {
      const eok = Math.floor(manValue / 10000);
      const remainMan = manValue % 10000;
      if (remainMan === 0) {
        return `${eok.toLocaleString("ko-KR")} 억원`;
      }
      return `${eok.toLocaleString("ko-KR")} 억 ${remainMan.toLocaleString("ko-KR")} 만원`;
    }
    
    const formatted = manValue.toLocaleString("ko-KR");
    return `${formatted} 만원`;
  }

  function getFinancialIncomeStatus(annualIncomeWon) {
    const income = Number(annualIncomeWon || 0);
    // [Safety Margin Policy] Financial_Taxation_Reference.md 기준 (4% 마진 적용)
    // 실제 기준(2,000만 / 과거 고액기준 3,400만) 대비 안전 마진을 적용하여 보수적으로 경고
    if (income > 32640000) return "crit"; // 치명적 경고 (3,400만 * 0.96)
    if (income > 19200000) return "warn"; // 과세 주의 (2,000만 * 0.96)
    return "normal";
  }

  function calculateIncomeTax(taxableIncomeWon) {
    const income = Math.max(0, Number(taxableIncomeWon || 0));
    
    // 1. 기본 국세 누진세액 계산 함수 (2024년 소득세법 개정안 기준)
    const getProgressiveTax = (amount) => {
      if (amount <= 14000000) return amount * 0.06;
      if (amount <= 50000000) return amount * 0.15 - 1260000;
      if (amount <= 88000000) return amount * 0.24 - 5760000;
      if (amount <= 150000000) return amount * 0.35 - 15440000;
      if (amount <= 300000000) return amount * 0.38 - 19940000;
      if (amount <= 500000000) return amount * 0.40 - 25940000;
      if (amount <= 1000000000) return amount * 0.42 - 35940000;
      return amount * 0.45 - 65940000;
    };

    const LIMIT_20M = 20000000;
    const RATE_14 = 0.14;
    let baseTax = 0;

    if (income <= LIMIT_20M) {
      // 2,000만 원 이하: 14% 분리과세 (원천징수세율)
      baseTax = income * RATE_14;
    } else {
      // 2,000만 원 초과: 비교과세 원칙 적용 
      // [Simplified Model Notice] 금융소득 외 다른 종합소득이 0원이라고 가정하여 최저한세를 계산함.
      // 일반산출세액 = (2천만원 초과 금융소득) * 누진세율 + (2천만원 * 14%)
      const taxGeneral = getProgressiveTax(income - LIMIT_20M) + (LIMIT_20M * RATE_14);
      // 비교산출세액 = 금융소득 전체 * 14%
      const taxComparison = income * RATE_14;
      
      baseTax = Math.max(taxGeneral, taxComparison);
    }

    // 2. 지방소득세 10% 별도 부과 (국세의 10%)
    // 결과적으로 실효세율은 15.4%, 6.6%, 16.5%... 등으로 적용됨
    return Math.round(baseTax * 1.1);
  }

  function formatTimestamp(timestamp) {
    if (!timestamp) return "-";
    let parsed = Number(timestamp);
    if (Number.isNaN(parsed)) {
      parsed = Date.parse(timestamp);
    }
    if (!Number.isFinite(parsed)) return "-";
    return backupTimestampFormatter.format(new Date(parsed));
  }

  function sanitizeMoney(value, min = 0) {
    const raw = String(value || "0").replace(/[^0-9.-]/g, "");
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
      return min;
    }
    return Math.max(min, parsed);
  }

  function sanitizeRate(value, fallback = 0, limit = 100) {
    const raw = String(value || "0").replace(/[^0-9.-]/g, "");
    let parsed = parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return fallback;
    }
    if (parsed > limit) {
      parsed = limit;
    }
    return Math.round(parsed * 100) / 100;
  }

  function createId(prefix) {
    const safePrefix = String(prefix || "id").trim() || "id";
    const bytes = new Uint8Array(8);
    if (global.crypto && typeof global.crypto.getRandomValues === "function") {
      global.crypto.getRandomValues(bytes);
    } else {
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Math.floor(Math.random() * 256);
      }
    }
    const randomText = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return safePrefix + "-" + Date.now() + "-" + randomText;
  }

  function escapeHtml(unsafe) {
    const str = String(unsafe || "");
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return str.replace(/[&<>"']/g, (match) => entities[match]);
  }

  function toWon(amountInUnit) {
    if (!Number.isFinite(Number(amountInUnit))) {
      return 0;
    }
    return Math.round(Number(amountInUnit) * 10000);
  }
  function toMan(amountInWon) {
    if (!Number.isFinite(Number(amountInWon))) {
      return 0;
    }
    return Math.round(Number(amountInWon) / 10000);
  }

  function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
      if (timer) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(() => {
        fn(...args);
      }, delay);
    };
  }

  function roundTo(value, digit) {
    const factor = 10 ** digit;
    return Math.round(value * factor) / factor;
  }

  function idbRequestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function idbTransactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error("Transaction aborted"));
    });
  }

  const result = {
    APP_VERSION: "0.8.9",
    formatMoney,
    getFinancialIncomeStatus,
    calculateIncomeTax,
    formatTimestamp,
    sanitizeMoney,
    sanitizeRate,
    toWon,
    toMan,
    createId,
    escapeHtml,
    debounce,
    roundTo,
    idbRequestToPromise,
    idbTransactionDone,
  };

  if (global) {
    global.IsfUtils = result;
  }

  return result;
})((typeof window !== "undefined" ? window : null));

