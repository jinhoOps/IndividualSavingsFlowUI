(function initIsfUtils(global) {
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
    // 종합과세 대상 + 누진세율 본격화(3,400만) 버퍼 반영
    if (income > 32640000) return "crit";
    // 종합과세 기준(2,000만) 버퍼 반영
    if (income > 19200000) return "warn";
    return "normal";
  }

  function calculateIncomeTax(taxableIncomeWon) {
    const income = Math.max(0, Number(taxableIncomeWon || 0));
    // 2024년 이후 소득세법 개정안 기준 (단위: 원)
    if (income <= 14000000) {
      return Math.round(income * 0.06);
    } else if (income <= 50000000) {
      return Math.round(income * 0.15 - 1260000);
    } else if (income <= 88000000) {
      return Math.round(income * 0.24 - 5760000);
    } else if (income <= 150000000) {
      return Math.round(income * 0.35 - 15440000);
    } else if (income <= 300000000) {
      return Math.round(income * 0.38 - 19940000);
    } else if (income <= 500000000) {
      return Math.round(income * 0.40 - 25940000);
    } else if (income <= 1000000000) {
      return Math.round(income * 0.42 - 35940000);
    } else {
      return Math.round(income * 0.45 - 65940000);
    }
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

  global.IsfUtils = {
    APP_VERSION: "0.8.7",
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
})(window);

