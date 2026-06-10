---
phase: 1
wave: 1
depends_on: []
files_modified:
  - apps/step1/index.html
  - apps/step1/styles.css
  - apps/step1/modules/presets.js
  - apps/step1/app.js
autonomous: true
---

# Phase 1: 프리셋 템플릿 로드 및 자동 시각화

## Verification Criteria
- [ ] 연봉 수준을 선택하는 `<select>` 요소가 화면에 표시된다.
- [ ] 투자 성향(안정형, 중립형, 적극형)을 선택하는 버튼들이 표시된다.
- [ ] 프리셋 적용 시, 기존 데이터가 존재하면 `confirm()` 경고창이 표시된다.
- [ ] 프리셋 데이터가 내부 State에 정상적으로 덮어씌워지고 (원 단위 변환 적용) Sankey Diagram이 즉시 다시 그려진다.

## Tasks

### 1. Create Presets Data Module
```xml
<task type="execute">
  <action>
    Create a new file `apps/step1/modules/presets.js` and define the preset data structure.
    Export a `PRESET_SALARIES` array containing objects like `{ label: '3,000만원', value: 30000000, monthlyIncome: 2250000 }` (estimate after tax). Include increments up to 10,000만원.
    Export a `PRESET_STYLES` object containing keys `conservative`, `neutral`, `aggressive`. Each should define ratio distributions for `expenseRate`, `savingsRate`, `investRate` (e.g. neutral: 0.5, 0.3, 0.2).
    Export a function `applyPreset(salaryValue, styleKey)` that returns the calculated amounts (in 원).
  </action>
  <read_first>
    - apps/step1/modules/state.js
  </read_first>
  <acceptance_criteria>
    - `apps/step1/modules/presets.js` exports `PRESET_SALARIES`, `PRESET_STYLES`, and `applyPreset`
    - Returns amounts scaled correctly based on salary and ratios
  </acceptance_criteria>
</task>
```

### 2. Add Preset UI to HTML
```xml
<task type="execute">
  <action>
    Modify `apps/step1/index.html`. Inside the `<form id="inputsForm">`, add a new `<div class="controls-block" id="presetBlock">` right at the top (before "월 수입 항목").
    Include a `<select id="presetSalary">` for salary selection, and three `<button type="button" data-style="conservative|neutral|aggressive" class="btn btn-ghost btn-sm">` for the styles.
    Include a `<button type="button" id="applyPresetBtn" class="btn btn-primary btn-sm">프리셋 적용</button>`.
  </action>
  <read_first>
    - apps/step1/index.html
  </read_first>
  <acceptance_criteria>
    - `index.html` contains `<select id="presetSalary">`
    - `index.html` contains buttons for styles and application
  </acceptance_criteria>
</task>
```

### 3. Apply UI Styling
```xml
<task type="execute">
  <action>
    Modify `apps/step1/styles.css` to style the new preset block.
    Use existing CSS variables (`--sp-sm`, `--ink`) following `1-UI-SPEC.md`.
    Add an `.is-active` class style for the style selection buttons to distinguish the currently selected style.
    Ensure physical integrity of the file by adding styles before the media queries at the bottom.
  </action>
  <read_first>
    - apps/step1/styles.css
  </read_first>
  <acceptance_criteria>
    - `styles.css` has styles for the preset active states
    - Media queries at the bottom of the file are intact
  </acceptance_criteria>
</task>
```

### 4. Wire up Logic in app.js
```xml
<task type="execute">
  <action>
    Modify `apps/step1/app.js` to integrate the preset logic.
    1. Import `presets.js`.
    2. Populate the `#presetSalary` select on load.
    3. Add click listeners to the style buttons to toggle the `.is-active` class.
    4. On `#applyPresetBtn` click, read the selected salary and style. If current state `isDirty` or has user modifications, call `window.confirm('데이터 초기화 경고: 기존에 작성하신 자산 데이터가 모두 초기화되고 프리셋으로 덮어씌워집니다. 계속하시겠습니까?')`.
    5. If confirmed, call `applyPreset`, update the global state (`state.js`) with the new income, expense, savings, and investment amounts.
    6. Update DOM input fields to match the new state values.
    7. Call `markDirty()` and trigger a full re-render so the Sankey diagram updates.
  </action>
  <read_first>
    - apps/step1/app.js
    - apps/step1/modules/dom.js
    - apps/step1/modules/presets.js
  </read_first>
  <acceptance_criteria>
    - Clicking apply calculates new state and updates the visualization
    - The confirmation dialog appears if existing data is present
    - `markDirty()` is invoked to trigger the floating save bar
  </acceptance_criteria>
</task>
```
