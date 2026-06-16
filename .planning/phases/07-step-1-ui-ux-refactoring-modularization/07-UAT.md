---
status: diagnosed
phase: 07-step-1-ui-ux-refactoring-modularization
source:
  - 07-01-SUMMARY.md
  - 07-02-SUMMARY.md
  - 07-03-SUMMARY.md
  - 07-GAP-CLOSURE-SUMMARY.md
  - 07-UAT-RERUN-GAP-SUMMARY.md
started: 2026-06-16T17:20:00+09:00
updated: 2026-06-16T17:55:00+09:00
---

## Current Test

[testing complete]

## Tests

### 1. Account Flow Map Uses Correct Money Units
expected: 계좌 흐름도에서 계좌 잔액과 흐름 금액이 실제 값에 맞는 단위로 표시된다. 만 원 단위 값이 억 원처럼 과대 표시되지 않고, Sankey/요약과 같은 금액 감각으로 읽힌다.
result: issue
reported: "계좌흐름도 단위변환 적용 버그로 `만`단위가 `억`으로 보여"
severity: major

### 2. Step 1 Loads Through the Refactored Bootstrap
expected: Step 1 opens normally through the thin bootstrap entry. The main page title, summary, visualization, controls, projection, and comparison areas load without a startup error or blank primary surface.
result: pass

### 3. External Step 1 Inputs Load Safely With Formatted Money Inputs
expected: 프리셋, JSON 가져오기, ISF CODE 데이터, 백업 복원, 해시 복원, 공유 ID 로드가 Step 1 값을 정상적인 계좌/그룹 값으로 반영한다. 금액 입력은 쉼표 포맷을 유지하고, 깨진 UI나 원시 마크업, 스크립트처럼 보이는 텍스트가 화면에 렌더링되지 않는다.
result: issue
reported: "금액 입력 쉼표포맷:모든 금액입력이 아닌 설정에서만 제대로 보여, 초기 현금 및 투자 잔액 최대 입력값 5,000,000 이상 입력 불가 현상"
severity: major

### 4. Reset Initializes Neutral 50,000,000 KRW Preset In Place With Lower Capital
expected: 초기화/리셋을 누르면 연봉 50,000,000원의 중립형 프리셋이 현재 화면에서 바로 적용된다. 초기 현금/저축/투자 자본은 과하게 높지 않은 한 자리 낮춘 기준으로 보이고, 별도 샘플 데이터 화면으로 라우팅되지 않는다.
result: pass

### 5. Sample Load and Rates Controls Stay Merged Into Settings
expected: 별도 샘플 데이터 불러오기 경로는 보이지 않거나 예상치 못한 라우팅을 하지 않는다. 수익률/기타 컨트롤은 지출·저축·투자 메인 메뉴가 아니라 설정 영역에서 사용할 수 있다.
result: pass

### 6. Long Allocation Item Lists Collapse By Group
expected: 생활비처럼 하위 항목이 많은 지출·저축·투자 목록은 그룹 디렉터리처럼 접고 펼칠 수 있다. 접었을 때 세로 길이가 줄고, 펼쳤을 때 기존 항목 편집과 금액 표시가 유지된다.
result: issue
reported: "pass, 그런데 아예 지출입력하는거니까 , `생활비`를 대표그룹 고정비로  묶어주고, 고정비 하위 대표 그룹으로는 `공과금`,`통신비`,`교통비`,`식비` 는 모두 생활비 성격, 그외에 발생할수있는건 여행,취미,자기개발 등 자유로운 소비 사용자가 자유롭게 추가하는거 예시로 2가지로 여행,취미 정도만 해주면될듯.  저축하고 투자는 항목 자체가 그룹이라 저축은 저축, 투자는 투자자"
severity: minor

### 7. Sankey Detail Mode Honors Grouping Metadata
expected: 기본 Sankey 보기는 통합된 상태로 시작한다. 상세 탭에서도 강제로 전부 개별화하지 않고, 지출/저축/투자 grouping 메타데이터 선택에 따라 통합·그룹·상세 표시가 바뀐다.
result: issue
reported: "pass, 상세에서만 메타데이터 선택이 출력되면 좋겠습니다"
severity: minor

### 8. Mobile Step 1 Controls Stay Contained and Dense
expected: 태블릿과 좁은 모바일 화면에서 controls-block 행의 라벨, 입력칸, 단위 표시가 영역 안에 들어가고, 페이지 전체 가로 스크롤이 생기지 않는다. 접을 수 있는 영역은 실제로 세로 공간을 줄인다.
result: pass

### 9. Refined Step 1 Styling Stays Minimal
expected: Step 1 화면은 과한 radial glow 배경, 무거운 blur 효과, 과한 토글 윤곽선, 중첩 카드의 과도한 border 없이 컴팩트하고 미니멀한 공유 테마 스타일을 유지한다.
result: issue
reported: "pass, 토글의 이질감은 약하지만 남아있고, 입력관련 카드의 border는 여전히 복잡하여 컴팩트하지 않아보임"
severity: cosmetic

### 10. Phase 07 Regression Checks Remain Observable
expected: 시각화 탭 전환, 화면 크기 변경, 모바일 패널 펼침 이후에도 Sankey/network SVG가 0이 아닌 크기로 렌더링되고, Step 1 주요 패널 순서가 요약, 시각화, 컨트롤, 예측, 비교 순서로 유지된다.
result: pass

## Summary

total: 10
passed: 0
passed: 5
issues: 5
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "계좌 흐름도에서 계좌 잔액과 흐름 금액이 실제 값에 맞는 단위로 표시된다. 만 원 단위 값이 억 원처럼 과대 표시되지 않고, Sankey/요약과 같은 금액 감각으로 읽힌다."
  status: failed
  reason: "User reported: 계좌흐름도 단위변환 적용 버그로 `만`단위가 `억`으로 보여"
  severity: major
  test: 1
  root_cause: "`renderAll` passes Sankey/account node values and transfer values to `renderNetworkMap` in Won units, but `network-map-renderer.js` formats both link labels and node balances after multiplying by 10,000 again. This turns 만-level values into 억-level display values."
  artifacts:
    - path: "apps/main/modules/bootstrap-controller.js"
      issue: "`accountsWithValues` receives `node.value` from Sankey data without unit conversion before calling `renderNetworkMap`."
    - path: "apps/main/modules/network-map-renderer.js"
      issue: "Link labels use `IsfUtils.formatMoney(tr.value * 10000)` and node labels use `IsfUtils.formatMoney(valWon * 10000)` even though the values are already Won."
  missing:
    - "Remove the extra `* 10000` conversions in the network map renderer."
    - "Add a regression assertion that a 5,000,000 Won account renders as 500만 원, not 500억 원."
  debug_session: "inline-uat-diagnosis-2026-06-16-second-rerun"
- truth: "프리셋, JSON 가져오기, ISF CODE 데이터, 백업 복원, 해시 복원, 공유 ID 로드가 Step 1 값을 정상적인 계좌/그룹 값으로 반영한다. 금액 입력은 쉼표 포맷을 유지하고, 깨진 UI나 원시 마크업, 스크립트처럼 보이는 텍스트가 화면에 렌더링되지 않는다."
  status: failed
  reason: "User reported: 금액 입력 쉼표포맷:모든 금액입력이 아닌 설정에서만 제대로 보여, 초기 현금 및 투자 잔액 최대 입력값 5,000,000 이상 입력 불가 현상"
  severity: major
  test: 3
  root_cause: "Formatted Won handling was added to the settings form and active item editor rows, but not every user-facing money input path is covered consistently. In addition, settings form input immediately calls `markPendingChanges()`, which triggers `renderAll()` and `applyInputsToForm()` while the user is still typing. That full rerender rewrites formatted fields from sanitized state and can make `startCash`/`startInvest` appear capped or reverted around the default 5,000,000 value."
  artifacts:
    - path: "shared/core/utils.js"
      issue: "The global formatter only runs on inputs classified by `data-money-input`, name, data-field, class, or placeholder; coverage is incomplete for all money-entry surfaces."
    - path: "apps/main/modules/bootstrap-controller.js"
      issue: "The settings form input handler updates state, persists, and calls `renderAll()` on every keystroke."
    - path: "apps/main/modules/state-helpers.js"
      issue: "`applyInputsToForm` rewrites Won field values during render, which conflicts with active text entry."
    - path: "apps/main/modules/constants.js"
      issue: "`DEFAULT_INPUTS.startCash` and `DEFAULT_INPUTS.startInvest` are both 5,000,000, matching the apparent fallback/cap value reported by the user."
  missing:
    - "Create a single money-input formatting path for all Won inputs, including modal/preset, item editors, transfer rules if applicable, and settings."
    - "Avoid full form value rewrites while the active money input is being edited, or debounce/commit without replacing the active field."
    - "Add tests for entering values above 5,000,000 into `startCash` and `startInvest`."
  debug_session: "inline-uat-diagnosis-2026-06-16-second-rerun"
- truth: "생활비처럼 하위 항목이 많은 지출·저축·투자 목록은 그룹 디렉터리처럼 접고 펼칠 수 있다. 접었을 때 세로 길이가 줄고, 펼쳤을 때 기존 항목 편집과 금액 표시가 유지된다."
  status: failed
  reason: "User reported: pass, 그런데 아예 지출입력하는거니까 , `생활비`를 대표그룹 고정비로  묶어주고, 고정비 하위 대표 그룹으로는 `공과금`,`통신비`,`교통비`,`식비` 는 모두 생활비 성격, 그외에 발생할수있는건 여행,취미,자기개발 등 자유로운 소비 사용자가 자유롭게 추가하는거 예시로 2가지로 여행,취미 정도만 해주면될듯.  저축하고 투자는 항목 자체가 그룹이라 저축은 저축, 투자는 투자자"
  severity: minor
  test: 6
  root_cause: "The collapsible list groups by the last segment of the existing `item.group` string for every allocation type. Current seed data uses mixed paths like `생활비-고정비-공과금` while some defaults such as 교통비/식비 have no group, and savings/investment are also grouped through the same path logic even though their item categories are already the grouping layer."
  artifacts:
    - path: "apps/main/modules/list-renderer.js"
      issue: "`getAllocationGroupName` always uses the final `-` segment, regardless of whether the list is expense, savings, or invest."
    - path: "apps/main/modules/presets.js"
      issue: "Expense seed data has partial group paths and lacks the requested 생활비/자유소비 taxonomy."
    - path: "apps/main/modules/constants.js"
      issue: "Default expense items include ungrouped 교통비, 식비, and 기타생활비."
  missing:
    - "Normalize expense seed groups into 생활비/고정비 and 자유소비 examples such as 여행 and 취미."
    - "Treat savings items under a 저축 grouping and investment items under a 투자 grouping, while preserving item names as editable items."
    - "Add regression coverage for the desired default group labels."
  debug_session: "inline-uat-diagnosis-2026-06-16-second-rerun"
- truth: "기본 Sankey 보기는 통합된 상태로 시작한다. 상세 탭에서도 강제로 전부 개별화하지 않고, 지출/저축/투자 grouping 메타데이터 선택에 따라 통합·그룹·상세 표시가 바뀐다."
  status: failed
  reason: "User reported: pass, 상세에서만 메타데이터 선택이 출력되면 좋겠습니다"
  severity: minor
  test: 7
  root_cause: "The grouping metadata controls are rendered unconditionally in the Sankey header. Detail mode now honors those controls, but the UI does not hide them in basic/network mode, so metadata controls appear outside the context where the user wants to edit them."
  artifacts:
    - path: "apps/main/index.html"
      issue: "`.sankey-grouping-controls` is always present in the header."
    - path: "apps/main/modules/bootstrap-controller.js"
      issue: "`setSankeyDetailMode` updates the mode and rerenders the chart but does not toggle grouping-control visibility."
    - path: "apps/main/modules/ui-controller.js"
      issue: "Sankey UI sync only sets select values and does not expose detail-mode-only visibility state."
  missing:
    - "Show grouping metadata controls only when Sankey detail mode is active."
    - "Hide the controls in basic and account-flow network views without losing current select state."
    - "Add a UI regression check for grouping-control visibility across visualization modes."
  debug_session: "inline-uat-diagnosis-2026-06-16-second-rerun"
- truth: "Step 1 화면은 과한 radial glow 배경, 무거운 blur 효과, 과한 토글 윤곽선, 중첩 카드의 과도한 border 없이 컴팩트하고 미니멀한 공유 테마 스타일을 유지한다."
  status: failed
  reason: "User reported: pass, 토글의 이질감은 약하지만 남아있고, 입력관련 카드의 border는 여전히 복잡하여 컴팩트하지 않아보임"
  severity: cosmetic
  test: 9
  root_cause: "The previous visual-noise pass added lower-priority overrides near the end of `styles.css`, but several earlier and more specific rules still draw bordered nested cards, active tab underlines, input-card outlines, and hover border changes. The dense editing rows also keep explicit borders/backgrounds with `!important`, so the interface still reads card-heavy."
  artifacts:
    - path: "apps/main/styles.css"
      issue: "Rules for `.advanced-block`, `.advanced-block>.tab-list`, `.controls-block`, `.income-row.is-editing`, `.expense-row.is-editing`, `.savings-row.is-editing`, and `.invest-row.is-editing` retain strong borders/backgrounds."
    - path: "apps/main/styles.css"
      issue: "Later `#visualizationToggle` overrides reduce but do not fully harmonize the segmented control with the surrounding header."
  missing:
    - "Simplify input-related cards and editing rows toward unframed rows or very light separators."
    - "Reduce tab/toggle styling further while preserving visible focus states."
    - "Review dense settings and item-editor screenshots after the CSS pass."
  debug_session: "inline-uat-diagnosis-2026-06-16-second-rerun"
