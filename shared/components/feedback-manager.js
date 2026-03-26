(function initIsfFeedback(global) {
  "use strict";

  // Using a class-like closure for multiple feedback instances or singletons
  // Both step1 and step2 have a floating feedback container.
  // We can pass the DOM element to the generic show method.

  let applyFeedbackTimer = null;

  function showFeedback(domElement, message, isError = false, timeoutMs = 3500) {
    if (!domElement) return;
    
    // Clear existing timer
    if (applyFeedbackTimer) {
      window.clearTimeout(applyFeedbackTimer);
      applyFeedbackTimer = null;
    }

    const content = typeof message === "string" ? message.trim() : "";
    if (!content) {
      domElement.hidden = true;
      return;
    }

    domElement.textContent = content;
    domElement.hidden = false;
    domElement.style.background = isError ? "var(--color-danger)" : "var(--color-accent)";
    domElement.style.color = "var(--color-bg)";

    // Fallback animation trigger if css defines it
    domElement.classList.remove("fade-out");
    void domElement.offsetWidth; // trigger reflow
    domElement.classList.add("fade-in");

    applyFeedbackTimer = window.setTimeout(() => {
      domElement.hidden = true;
    }, timeoutMs);
  }

  function markPendingBar(barElement, summaryElement, isPending, message = "") {
    if (!barElement) return;
    if (isPending) {
      barElement.classList.add("visible");
      barElement.setAttribute("aria-hidden", "false");
      if (summaryElement && message) {
        summaryElement.textContent = message;
      }
    } else {
      barElement.classList.remove("visible");
      barElement.setAttribute("aria-hidden", "true");
    }
  }

  global.IsfFeedback = {
    showFeedback,
    markPendingBar
  };

})(window);
