import re

filepath = r'd:\jhkSandBox\CODE\IndividualSavingsFlowUI\apps\step2\app.js'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add pending DOM elements
dom_elements = """    importJsonTrigger: document.getElementById("importJsonTrigger"),
    pendingBar: document.getElementById("pendingBar"),
    pendingSummary: document.getElementById("pendingSummary"),
    saveChanges: document.getElementById("saveChanges"),
    discardChanges: document.getElementById("discardChanges"),"""

# In case it only had importJsonTrigger
content = re.sub(r'importJsonTrigger: document\.getElementById\("importJsonTrigger"\),?', dom_elements, content)

# 2. Modify markDirty and markClean
mark_dirty_new = """  function markDirty() {
    state.dirty = true;
    IsfFeedback.markPendingBar(dom.pendingBar, dom.pendingSummary, true);
  }"""

mark_clean_new = """  function markClean() {
    state.dirty = false;
    IsfFeedback.markPendingBar(dom.pendingBar, dom.pendingSummary, false);
  }"""

content = re.sub(r'function markDirty\(\) \{\s*state\.dirty = true;\s*\}', mark_dirty_new, content)
content = re.sub(r'function markClean\(\) \{\s*state\.dirty = false;\s*\}', mark_clean_new, content)

# 3. Add listeners to bindControls
bind_controls_additions = """function bindControls() {
  if (dom.saveChanges) {
    dom.saveChanges.addEventListener("click", async () => {
      await saveCurrentPortfolio();
    });
  }
  if (dom.discardChanges) {
    dom.discardChanges.addEventListener("click", async () => {
      if (state.currentPortfolioId) {
        await loadPortfolioById(state.currentPortfolioId);
      } else {
        resetDraft();
      }
      IsfFeedback.showFeedback(dom.step2Feedback, "변경사항을 취소했습니다.", false);
    });
  }
"""
content = content.replace("function bindControls() {", bind_controls_additions)

# 4. Modify bridge import to markDirty instead of markClean
# We only want to replace it inside importLatestBridgeIntoDraft
import_function_end = """      setActiveChartTab("summary");
      markDirty();
      renderDraft();"""

# Original was:
#      setActiveChartTab("summary");
#      markClean();
#      renderDraft();
content = content.replace('setActiveChartTab("summary");\n      markClean();\n      renderDraft();', import_function_end)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

