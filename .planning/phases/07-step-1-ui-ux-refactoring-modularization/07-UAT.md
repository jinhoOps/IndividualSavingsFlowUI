---
status: resolved
phase: 07-step-1-ui-ux-refactoring-modularization
source:
  - 07-01-SUMMARY.md
  - 07-02-SUMMARY.md
  - 07-03-SUMMARY.md
started: 2026-06-16T14:56:55.1173453+09:00
updated: 2026-06-16T15:35:54.0447995+09:00
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Clear ephemeral state (temp DBs, caches, lock files). Start the application from scratch. Server boots without errors, any seed/migration completes, and a primary query (health check, homepage load, or basic API call) returns live data.
result: issue
reported: "데이터 확인을 위해 샘플불러오기 하니까 라우팅 이상했고, 아예 초기화를 누르면 샘플 데이터로 초기화 해주는게 좋겠어. (값은 프리셋에서 중립형 연봉 5천만원)"
severity: major

### 2. Step 1 Loads Through the Refactored Bootstrap
expected: Opening the Step 1 app shows the same usable initial experience as before the refactor, with the page loaded, primary Step 1 controls available, and no visible startup failure.
result: pass

### 3. External Step 1 Inputs Load Safely
expected: Applying presets, JSON imports, ISF CODE data, backup restores, sample data, hash restores, or share-id loads updates Step 1 with sane account/group values without showing broken UI, raw markup, or script-like text as rendered HTML.
result: issue
reported: "프리셋- x , json 가져오기 - o , isf code 데이터 백업복원 - o , 샘플데이터 - x (제거하고 초기화 기능에 합병), 해시복원 : O"
severity: major

### 4. Account and Group Selectors Render Options Correctly
expected: Account and group selector options appear as selectable text labels, preserve unusual characters as text, and do not break the selector layout or inject visible HTML controls.
result: issue
reported: "기능은 정상 동작 하는것으로 보이나 계좌 관리 UIUX 가 너무 어렵게되어있어서 이용 자체 가 어려움 / 지출저축투자 메뉴의 `수익률/기타`는 설정 에서 하는게 맞을듯."
severity: major

### 5. Desktop Panel Order Matches the Phase 7 Layout
expected: On a desktop viewport, the Step 1 panels appear in this order: Summary, Visualization, Controls, Projection, Comparison.
result: pass

### 6. Tablet and Mobile Panel Order Matches the Phase 7 Layout
expected: At tablet and narrow mobile widths, the Step 1 panels keep the same order: Summary, Visualization, Controls, Projection, Comparison.
result: pass

### 7. Mobile Step 1 Controls Stay Contained
expected: At narrow mobile width, tabs, visualization controls, advanced tab lists, and scrollable control areas remain usable without page-level horizontal overflow or clipped primary controls.
result: issue
reported: "`<div class=\"controls-block\">` 여기에 단위 표시 벗어난게 많음,라벨 크기가 작기 때문에 인풋영역을 한줄로 표기가능하여 화면 밀도 향상"
severity: major

### 8. Visualization Remains Visible After Interaction
expected: Switching visualization tabs or resizing the viewport leaves the Sankey/network visualization attached to the page with a visible, non-zero rendered area.
result: issue
reported: "pass, 그런데 생키 - 상세 로 볼때 고정비 하위항목으로 갈라져서 전부 보여야 하는데 기본보기랑 다를게 없어"
severity: major

### 9. Refined Step 1 Styling Has No Decorative Ambient Effects
expected: The Step 1 screen uses the compact shared theme styling without decorative radial glow backgrounds, heavy blur effects, or visibly inconsistent token drift from the rest of the app.
result: pass

## Summary

total: 9
passed: 4
issues: 5
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Cold start and initial sample-data path should leave the Step 1 app in a usable state with live data."
  status: resolved
  reason: "User reported: 데이터 확인을 위해 샘플불러오기 하니까 라우팅 이상했고, 아예 초기화를 누르면 샘플 데이터로 초기화 해주는게 좋겠어. (값은 프리셋에서 중립형 연봉 5천만원)"
  severity: major
  test: 1
  root_cause: "`handleLoadSample` builds a view-mode share link and assigns `window.location.href`, while `handleResetInputs` zeroes the current inputs. The cold-start sample path is routing-driven instead of in-place initialization, and reset does not use the requested neutral 50,000,000 KRW preset."
  artifacts:
    - path: "apps/main/modules/bootstrap-controller.js"
      issue: "`handleLoadSample` navigates through a share link; `handleResetInputs` calls `createResetInputs` to zero values."
    - path: "apps/main/modules/presets.js"
      issue: "`applyPresetBySalary(50000000, 'neutral')` exists as the likely initialization source."
  missing:
    - "Remove the separate sample navigation path or make it an alias of reset/initialization."
    - "Reset/initialization should load the neutral preset with annual income 50,000,000 KRW."
  debug_session: "inline-uat-diagnosis-2026-06-16"
- truth: "In Sankey detail mode, fixed expenses should split into and display all lower-level fixed-cost subitems rather than matching the basic view."
  status: resolved
  reason: "User reported: pass, 그런데 생키 - 상세 로 볼때 고정비 하위항목으로 갈라져서 전부 보여야 하는데 기본보기랑 다를게 없어"
  severity: major
  test: 8
  root_cause: "The detail/basic toggle updates `state.sankeyDetailMode`, but `buildSankeyData` still receives `state.sankeyGrouping`. When expense grouping remains `total`, the builder creates one `total-expense` node, so detail mode can render like basic mode instead of forcing individual fixed-expense child nodes."
  artifacts:
    - path: "apps/main/modules/bootstrap-controller.js"
      issue: "`setSankeyDetailMode('detail')` changes detail mode without changing the grouping inputs."
    - path: "apps/main/modules/sankey-renderer.js"
      issue: "Detail mode only bypasses mobile overload collapse; it does not request item-level grouping."
    - path: "apps/main/modules/sankey-builder.js"
      issue: "`setting === 'total'` aggregates fixed expenses into a single parent node."
  missing:
    - "In Sankey detail mode, force expense breakdown to item/detail level or make detail mode override total grouping for fixed expenses."
    - "Add a regression assertion that detail mode displays more fixed-expense nodes than basic mode when subitems exist."
  debug_session: "inline-uat-diagnosis-2026-06-16"
- truth: "Preset loading and sample-data loading should update Step 1 safely like JSON import, ISF CODE backup restore, and hash restore."
  status: resolved
  reason: "User reported: 프리셋- x , json 가져오기 - o , isf code 데이터 백업복원 - o , 샘플데이터 - x (제거하고 초기화 기능에 합병), 해시복원 : O"
  severity: major
  test: 3
  root_cause: "JSON, backup, ISF CODE, and hash restore commit normalized inputs in place, but sample data still navigates through a view-mode share URL and preset application is split between legacy/modal paths with current-income defaults. This makes external input behavior inconsistent."
  artifacts:
    - path: "apps/main/modules/bootstrap-controller.js"
      issue: "Preset, modal preset, sample, JSON import, backup restore, and hash restore use different application paths."
    - path: "apps/main/index.html"
      issue: "`샘플 불러오기`, `프리셋`, and `초기화` are exposed as separate adjacent actions despite overlapping user intent."
  missing:
    - "Remove the separate sample-data flow or merge it into reset/initialization."
    - "Reset/initialization should load the neutral preset with annual income 50,000,000 KRW."
    - "Make preset application complete in-place with clear feedback and no unexpected routing."
  debug_session: "inline-uat-diagnosis-2026-06-16"
- truth: "Account/group management should be understandable enough for normal use, and return/other settings for expense/saving/investment should live in settings rather than the main spending/saving/investment menu."
  status: resolved
  reason: "User reported: 기능은 정상 동작 하는것으로 보이나 계좌 관리 UIUX 가 너무 어렵게되어있어서 이용 자체 가 어려움 / 지출저축투자 메뉴의 `수익률/기타`는 설정 에서 하는게 맞을듯."
  severity: major
  test: 4
  root_cause: "Account management is exposed as dense editable lists and transfer-rule controls in the same tab. The rates block already lives under Settings in markup, but the advanced tab still renders a `수익률/기타` tab button in the spending/saving/investment section pointing at the moved settings block, preserving confusing navigation."
  artifacts:
    - path: "apps/main/index.html"
      issue: "`advancedTabRates` remains in the detailed item tab list while `ratesAdvancedBlock` is placed in the Settings panel."
    - path: "apps/main/styles.css"
      issue: "Account editor styles emphasize dense row editing rather than a simpler guided account-management flow."
  missing:
    - "Simplify account management UX and reduce cognitive load."
    - "Move `수익률/기타` from the 지출저축투자 menu into settings."
    - "Remove or reroute the stale `advancedTabRates` entry from the item-management tab list."
  debug_session: "inline-uat-diagnosis-2026-06-16"
- truth: "Mobile controls-block rows should keep unit labels contained and use available width efficiently, including one-line label/input layouts where practical."
  status: resolved
  reason: "User reported: `<div class=\"controls-block\">` 여기에 단위 표시 벗어난게 많음,라벨 크기가 작기 때문에 인풋영역을 한줄로 표기가능하여 화면 밀도 향상"
  severity: major
  test: 7
  root_cause: "Unit labels are implemented with absolutely positioned `.control::after` suffixes at a fixed right/bottom offset, while `.control` remains a stacked grid. On compact controls-block layouts this can detach suffixes from inputs and wastes horizontal space that could support one-line label/input rows."
  artifacts:
    - path: "apps/main/styles.css"
      issue: "`.control::after` uses fixed absolute positioning; `.control` is grid-stacked with no compact row variant for mobile controls-block density."
    - path: "apps/main/index.html"
      issue: "Controls inside multiple `.controls-block` sections rely on the generic `.control` structure."
  missing:
    - "Fix overflowing unit labels inside `.controls-block`."
    - "Increase mobile screen density by laying out compact labels and input areas on one line where practical."
    - "Add mobile regression coverage for suffix containment in `.controls-block`."
  debug_session: "inline-uat-diagnosis-2026-06-16"
