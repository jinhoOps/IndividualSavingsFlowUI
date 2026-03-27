import re
import os

app_js_path = r'd:\jhkSandBox\CODE\IndividualSavingsFlowUI\apps\step2\app.js'
styles_path = r'd:\jhkSandBox\CODE\IndividualSavingsFlowUI\shared\styles\step-theme.css'

# 1. Update app.js
with open(app_js_path, 'r', encoding='utf-8') as f:
    app_js = f.read()

# Update isAllocationTotalValid
app_js = re.sub(
    r'function isAllocationTotalValid\(account\) \{\s*return Math\.abs\(getAllocationWeightTotal\(account\) - 100\) <= 0\.01;\s*\}',
    'function isAllocationTotalValid(account) {\n    return getAllocationWeightTotal(account) <= 100.01;\n  }',
    app_js
)

# Update renderAllocationSummary
render_alloc_orig = """  function renderAllocationSummary() {
    if (!(dom.allocationSummary instanceof HTMLElement)) {
      return;
    }
    const account = ensureActiveAccountSelected();
    if (!account) {
      dom.allocationSummary.textContent = "계좌를 먼저 선택하세요.";
      dom.allocationSummary.classList.add("is-error");
      return;
    }
    const totalWeight = getAllocationWeightTotal(account);
    const valid = isAllocationTotalValid(account);
    dom.allocationSummary.textContent = valid
      ? `비중 합계 ${totalWeight.toFixed(2)}% (정상)`
      : `비중 합계 ${totalWeight.toFixed(2)}% (100% 기준 미충족)`;
    dom.allocationSummary.classList.toggle("is-error", !valid);
  }"""

render_alloc_new = """  function renderAllocationSummary() {
    if (!(dom.allocationSummary instanceof HTMLElement)) {
      return;
    }
    const account = ensureActiveAccountSelected();
    if (!account) {
      dom.allocationSummary.textContent = "계좌를 먼저 선택하세요.";
      dom.allocationSummary.classList.add("is-error");
      return;
    }
    const totalWeight = getAllocationWeightTotal(account);
    const overweight = totalWeight > 100.01;
    const underweight = totalWeight < 99.99;
    
    if (overweight) {
      dom.allocationSummary.textContent = `비중 합계 ${totalWeight.toFixed(2)}% (비중합계 100% 초과합니다)`;
      dom.allocationSummary.classList.add("is-error");
      dom.allocationSummary.classList.remove("is-warning");
    } else if (underweight) {
      dom.allocationSummary.textContent = `비중 합계 ${totalWeight.toFixed(2)}% (설정하지 않은 비중은 현금으로 처리됩니다)`;
      dom.allocationSummary.classList.remove("is-error");
      dom.allocationSummary.classList.add("is-warning");
    } else {
      dom.allocationSummary.textContent = `비중 합계 ${totalWeight.toFixed(2)}% (정상)`;
      dom.allocationSummary.classList.remove("is-error");
      dom.allocationSummary.classList.remove("is-warning");
    }
  }"""

app_js = app_js.replace(render_alloc_orig, render_alloc_new)

with open(app_js_path, 'w', encoding='utf-8') as f:
    f.write(app_js)

# 2. Append CSS to step-theme.css
css_to_append = """
/* Shared Pending Bar */
.pending-bar {
  position: fixed;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(16, 34, 32, 0.24);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 12px 28px rgba(16, 34, 32, 0.2);
}

.pending-bar[hidden] {
  display: none !important;
}

.pending-summary {
  margin: 0;
  font-size: 0.8rem;
  color: var(--ink);
  white-space: nowrap;
}

.pending-actions {
  display: flex;
  gap: 8px;
}

@media (max-width: 760px) {
  .pending-bar {
    width: min(340px, calc(100vw - 20px));
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 12px;
  }
  .pending-summary {
    white-space: normal;
    font-size: 0.82rem;
  }
  .pending-actions {
    width: 100%;
  }
  .pending-actions .btn {
    flex: 1;
  }
}

.is-warning {
  color: #c46200 !important;
}
"""

with open(styles_path, 'r', encoding='utf-8') as f:
    css_content = f.read()

if '.pending-bar' not in css_content:
    with open(styles_path, 'a', encoding='utf-8') as f:
        f.write(css_to_append)

print("Patch applied successfully.")
