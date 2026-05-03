(function initIsfFeedback(global) {
  "use strict";

  let applyFeedbackTimer = null;

  
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

  
  function notifyAutoSave(status) {
    const feedbackEl = document.getElementById("applyFeedback");
    if (!feedbackEl) return;

    if (status === "saving") {
      showFeedback(feedbackEl, "변경사항을 저장 중입니다...", false, 10000);
    } else if (status === "success") {
      showFeedback(feedbackEl, "자동 저장되었습니다.", false, 2000);
    } else if (status === "error") {
      showFeedback(feedbackEl, "자동 저장에 실패했습니다.", true, 4000);
    }
  }

  global.IsfFeedback = {
    showFeedback,
    markPendingBar,
    notifyAutoSave,
  };
})(window);

