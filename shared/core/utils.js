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
    const manValue = numericValue / 10000;
    // 소수점 둘째자리까지 표시하되, 불필요한 소수점은 제거하여 출력
    const formatted = Number(manValue.toFixed(2)).toLocaleString("ko-KR");
    return `${formatted} 만원`;
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
    return Number(amountInWon) / 10000;
  }

  global.IsfUtils = {
    formatMoney,
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
