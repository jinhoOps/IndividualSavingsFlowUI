(function initIsfFeedback(global) {
  "use strict";

  let applyFeedbackTimer = null;

  /**
   * 플로팅 토스트 피드백을 일시적으로 표시합니다.
   * @param {HTMLElement} domElement - 토스트 요소 (예: #applyFeedback)
   * @param {string} message - 표시할 메시지
   * @param {boolean} isError - 에러 여부
   * @param {number} timeoutMs - 자동 숨김 시간(ms)
   */
  function showFeedback(domElement, message, isError, timeoutMs) {
    if (!domElement) return;

    if (applyFeedbackTimer) {
      window.clearTimeout(applyFeedbackTimer);
      applyFeedbackTimer = null;
    }

    const safeTimeout = typeof timeoutMs === "number" && timeoutMs > 0 ? timeoutMs : 3500;
    const content = typeof message === "string" ? message.trim() : "";
    if (!content) {
      domElement.hidden = true;
      return;
    }

    domElement.textContent = content;
    domElement.hidden = false;

    if (isError) {
      domElement.classList.add("is-error");
    } else {
      domElement.classList.remove("is-error");
    }

    applyFeedbackTimer = window.setTimeout(() => {
      domElement.hidden = true;
    }, safeTimeout);
  }

  /**
   * 하단 대기 바의 표시/숨김을 제어합니다.
   * @param {HTMLElement} barElement - 대기 바 요소 (예: #pendingBar)
   * @param {HTMLElement} summaryElement - 요약 텍스트 요소 (예: #pendingSummary)
   * @param {boolean} isPending - 대기 상태 여부
   * @param {string} message - 대기 바에 표시할 메시지
   */
  function markPendingBar(barElement, summaryElement, isPending, message) {
    if (!barElement) return;
    if (isPending) {
      barElement.hidden = false;
      barElement.setAttribute("aria-hidden", "false");
      if (summaryElement) {
        summaryElement.textContent = message || "변경사항 대기 중";
      }
    } else {
      barElement.hidden = true;
      barElement.setAttribute("aria-hidden", "true");
      if (summaryElement) {
        summaryElement.textContent = "";
      }
    }
  }

  global.IsfFeedback = {
    showFeedback,
    markPendingBar,
  };
})(window);
