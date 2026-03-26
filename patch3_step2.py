import re

filepath = r'd:\jhkSandBox\CODE\IndividualSavingsFlowUI\apps\step2\app.js'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Auto save when importing from step1
content = content.replace(
    'markDirty();\n      renderDraft();\n      const importStatusBySource',
    'markDirty();\n      renderDraft();\n      await saveCurrentPortfolio();\n      const importStatusBySource'
)

# Append beforeunload handler
beforeunload_code = """
window.addEventListener("beforeunload", (e) => {
  // If the app is in a dirty state, show a generic browser warning
  // state is local scoped so we assume this runs after app.js loads
  // wait, state is inside an IIFE, we cannot access it globally!
});
"""
# Wait, state is inside the IIFE so we must append it INSIDE the IIFE!
# The IIFE ends with })();
# Let's insert the beforeunload just before })();
beforeunload_listener = """
  window.addEventListener("beforeunload", (e) => {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = "변경사항이 있습니다. 나가시겠습니까?";
    }
  });

})();"""

content = content.replace('})();', beforeunload_listener)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

