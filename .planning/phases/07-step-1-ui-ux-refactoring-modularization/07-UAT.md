---
status: diagnosed
phase: 07-step-1-ui-ux-refactoring-modularization
source:
  - 07-01-SUMMARY.md
  - 07-02-SUMMARY.md
  - 07-03-SUMMARY.md
  - 07-GAP-CLOSURE-SUMMARY.md
started: 2026-06-16T15:48:31.3902191+09:00
updated: 2026-06-16T16:30:49.8121375+09:00
---

## Current Test
[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Clear ephemeral state (temp DBs, caches, lock files). Start the application from scratch. Server boots without errors, the Step 1 page loads, and the primary app surface returns live data without startup failure.
result: pass

### 2. Step 1 Loads Through the Refactored Bootstrap
expected: Opening the Step 1 app shows the same usable initial experience as before the refactor, with the page loaded, primary Step 1 controls available, and no visible startup failure.
result: pass

### 3. External Step 1 Inputs Load Safely
expected: 프리셋, JSON 가져오기, ISF CODE 데이터, 백업 복원, 해시 복원, 공유 ID 로드가 Step 1 값을 정상적인 계좌/그룹 값으로 반영하고, 깨진 UI나 원시 마크업, 스크립트처럼 보이는 텍스트가 화면에 렌더링되지 않는다.
result: issue
reported: "pass, 실시간 변환 글자 표시때문에 복잡도 높아지고 열이 깨짐, 초기 현금 helper 미동작, 돈 입력값 0개수 3개마다 `,`표시 추가되었으면 좋겠음"
severity: major

### 4. Reset Initializes Neutral 50,000,000 KRW Preset In Place
expected: 초기화/리셋을 누르면 연봉 50,000,000원의 중립형 프리셋이 현재 화면에서 바로 적용되고, 명확한 피드백이 보이며, 별도 샘플 데이터 화면으로 라우팅되지 않는다.
result: issue
reported: "pass, 그런데 초기값으로 자본이 높게 찍혀서 0 하나씩 뺀값이 좋을듯함"
severity: major

### 5. Sample Load Is Merged Into Reset
expected: 별도 샘플 데이터 불러오기 경로가 제거되었거나 더 이상 예상치 못한 라우팅을 하지 않고, 샘플 초기화 동작은 초기화/리셋을 통해 사용할 수 있다.
result: pass

### 6. Account Management and Rates Controls Are Understandable
expected: 계좌 관리는 계좌 이름 설정과 이체 규칙 설정을 구분할 수 있을 만큼 안내가 있고, `수익률/기타` 컨트롤은 지출·저축·투자 메인 메뉴가 아니라 설정에서 사용할 수 있다.
result: pass

### 7. Desktop Panel Order Matches the Phase 7 Layout
expected: 데스크톱 화면에서 Step 1 패널이 요약, 시각화, 컨트롤, 예측, 비교 순서로 표시된다.
result: pass

### 8. Tablet and Mobile Panel Order Matches the Phase 7 Layout
expected: 태블릿과 좁은 모바일 화면에서도 Step 1 패널이 요약, 시각화, 컨트롤, 예측, 비교 순서를 유지한다.
result: pass

### 9. Mobile Step 1 Controls Stay Contained and Dense
expected: 좁은 모바일 화면에서 controls-block 행의 라벨, 입력칸, 단위 표시가 영역 안에 들어가고, 페이지 전체 가로 스크롤이 생기지 않으며, 가능한 곳에서는 한 줄 라벨/입력 레이아웃으로 밀도 있게 표시된다.
result: issue
reported: "pass, 그러나 생활비 하위 항목이 많아 나열할 경우 세로 초과, 그룹을 생성하면 디렉토리처럼 쓸수 있어야 접어서 이를 해소 가능해보임"
severity: major

### 10. Visualization Remains Visible After Interaction
expected: 시각화 탭을 전환하거나 화면 크기를 바꿔도 Sankey/network 시각화가 페이지에 붙어 있고, 보이는 영역이 0이 아닌 크기로 렌더링된다.
result: issue
reported: "상세 탭에서 메타데이터로 조절한게 아닌 강제 개별화라 별로임. 기본은 전부 통합한걸로 보여주고 상세부터 아예 메타데이터 수정할수있게 해줘야하고, 계좌 흐름도는 작게보여서 보기가 힘들어"
severity: major

### 11. Sankey Detail Mode Expands Lower-Level Items
expected: Sankey 상세 모드에서 고정비와 다른 상위 카테고리가 기본 통합 보기와 같지 않고, 하위 항목으로 분리되어 표시된다.
result: pass

### 12. Refined Step 1 Styling Has No Decorative Ambient Effects
expected: Step 1 화면은 과한 radial glow 배경, 무거운 blur 효과, 다른 화면과 어긋나는 토큰 스타일 없이 컴팩트한 공유 테마 스타일을 사용한다.
result: issue
reported: "일부 토글이 전체적인 ui 에서 눈에 띔, `visualizationToggle`는 예시고 전체적으로 카드내의 항목이 복잡할때 과도한 윤곽선 표시 등등 전체적인 미니멀 추구 필요"
severity: cosmetic

## Summary

total: 12
passed: 7
issues: 5
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "프리셋, JSON 가져오기, ISF CODE 데이터, 백업 복원, 해시 복원, 공유 ID 로드가 Step 1 값을 정상적인 계좌/그룹 값으로 반영하고, 깨진 UI나 원시 마크업, 스크립트처럼 보이는 텍스트가 화면에 렌더링되지 않는다."
  status: failed
  reason: "User reported: pass, 실시간 변환 글자 표시때문에 복잡도 높아지고 열이 깨짐, 초기 현금 helper 미동작, 돈 입력값 0개수 3개마다 `,`표시 추가되었으면 좋겠음"
  severity: major
  test: 3
  root_cause: "Global numeric-input hinting inserts `.realtime-won-hint` nodes after every eligible number input, which increases row height and breaks dense editor grids. Won inputs remain `type=number`, so browser values cannot display thousands separators. Initial cash has no field-specific helper beyond the generic realtime conversion path, so the requested helper behavior is not attached to `startCash`."
  artifacts:
    - path: "shared/core/utils.js"
      issue: "`updateAllKoreanWonHints` dispatches input events globally and the document input handler creates `.realtime-won-hint` elements after number inputs."
    - path: "apps/main/index.html"
      issue: "Won fields including `startCash` use `type=\"number\"`, which prevents formatted comma display inside the input value."
    - path: "apps/main/modules/state-helpers.js"
      issue: "Form read/write paths parse raw numeric values directly and do not support a formatted text input value layer."
  missing:
    - "Replace always-visible realtime conversion helper with a lower-noise pattern that does not alter row layout."
    - "Add a dedicated initial-cash helper or tooltip that works for `startCash`."
    - "Introduce display formatting for Won inputs, likely via text/inputmode decimal plus parse-on-read normalization."
  debug_session: "inline-uat-diagnosis-2026-06-16-rerun"
- truth: "초기화/리셋을 누르면 연봉 50,000,000원의 중립형 프리셋이 현재 화면에서 바로 적용되고, 명확한 피드백이 보이며, 별도 샘플 데이터 화면으로 라우팅되지 않는다."
  status: failed
  reason: "User reported: pass, 그런데 초기값으로 자본이 높게 찍혀서 0 하나씩 뺀값이 좋을듯함"
  severity: major
  test: 4
  root_cause: "Reset correctly calls `applyPresetBySalary(50000000, 'neutral')`, but the preset generator sets initial assets from salary multipliers intended to look rich: cash is 0.2x annual salary, savings are 8.0x, and invest is 2.0x for non-aggressive styles. For 50,000,000 KRW this produces very high starting capital instead of the requested one-zero-smaller neutral defaults."
  artifacts:
    - path: "apps/main/modules/bootstrap-controller.js"
      issue: "`createResetInputs` uses `applyPresetBySalary(50000000, 'neutral')` as intended."
    - path: "apps/main/modules/presets.js"
      issue: "`applyPresetBySalary` computes `startCash=0.2x`, `startSavings=8.0x`, and `startInvest=2.0x` annual salary for neutral style."
  missing:
    - "Tune neutral reset/preset starting-capital multipliers down by one decimal place, or add a reset-specific neutral seed profile."
    - "Add regression coverage for expected 50,000,000 KRW reset asset values."
  debug_session: "inline-uat-diagnosis-2026-06-16-rerun"
- truth: "좁은 모바일 화면에서 controls-block 행의 라벨, 입력칸, 단위 표시가 영역 안에 들어가고, 페이지 전체 가로 스크롤이 생기지 않으며, 가능한 곳에서는 한 줄 라벨/입력 레이아웃으로 밀도 있게 표시된다."
  status: failed
  reason: "User reported: pass, 그러나 생활비 하위 항목이 많아 나열할 경우 세로 초과, 그룹을 생성하면 디렉토리처럼 쓸수 있어야 접어서 이를 해소 가능해보임"
  severity: major
  test: 9
  root_cause: "Allocation item lists render as a flat list regardless of each item's `group` metadata. Editing also keeps every item expanded as a full row, so many 생활비 subitems inevitably exceed mobile vertical space. The Sankey legend already has a `details`-based grouped pattern, but item management does not reuse a collapsible directory/tree model."
  artifacts:
    - path: "apps/main/modules/list-renderer.js"
      issue: "`renderItemList` sorts then maps every item directly through `renderAllocationItemHtml`; it does not group items by `item.group` or render collapsible group containers."
    - path: "apps/main/modules/list-renderer.js"
      issue: "`renderAllocationItemHtml` emits full editing rows for every item, making dense mobile lists tall."
    - path: "apps/main/modules/sankey-renderer.js"
      issue: "`renderSankeyLegend` demonstrates an existing `details.legend-group-toggle` grouped disclosure pattern that could inform item-list grouping."
  missing:
    - "Render expense/savings/invest item lists grouped by `item.group` with collapsible directory-like sections."
    - "Persist open/closed group state during editing so long lists can be managed incrementally."
    - "Add mobile coverage for grouped item lists with many 생활비 children."
  debug_session: "inline-uat-diagnosis-2026-06-16-rerun"
- truth: "시각화 탭을 전환하거나 화면 크기를 바꿔도 Sankey/network 시각화가 페이지에 붙어 있고, 보이는 영역이 0이 아닌 크기로 렌더링된다."
  status: failed
  reason: "User reported: 상세 탭에서 메타데이터로 조절한게 아닌 강제 개별화라 별로임. 기본은 전부 통합한걸로 보여주고 상세부터 아예 메타데이터 수정할수있게 해줘야하고, 계좌 흐름도는 작게보여서 보기가 힘들어"
  severity: major
  test: 10
  root_cause: "Phase 07 gap closure made detail mode override grouping to `{ expense: 'detail', savings: 'detail', invest: 'detail' }` inside `renderSankey`, so the user's grouping metadata controls are bypassed in detail mode. The network map uses a fixed 400px container, small 100x38 account nodes, 9-11px labels, and no zoom/fullscreen controls, making the 계좌 흐름도 hard to read."
  artifacts:
    - path: "apps/main/modules/sankey-renderer.js"
      issue: "`renderSankey` forces all grouping categories to `detail` when `state.sankeyDetailMode === 'detail'`."
    - path: "apps/main/index.html"
      issue: "Grouping selects exist beside the visualization, but detail mode currently ignores them."
    - path: "apps/main/modules/network-map-renderer.js"
      issue: "Network map uses fixed sizing assumptions, small nodes and labels, and no user-controlled zoom/readability mode."
    - path: "apps/main/styles.css"
      issue: "`.network-map-inner` is fixed around 400px high, limiting readable space for the account map."
  missing:
    - "Keep basic view integrated by default, and make detail view expose/edit metadata grouping instead of forcing detail grouping."
    - "Make grouping controls effective in detail mode."
    - "Improve account-flow map readability with larger scale, zoom, or expanded view."
  debug_session: "inline-uat-diagnosis-2026-06-16-rerun"
- truth: "Step 1 화면은 과한 radial glow 배경, 무거운 blur 효과, 다른 화면과 어긋나는 토큰 스타일 없이 컴팩트한 공유 테마 스타일을 사용한다."
  status: failed
  reason: "User reported: 일부 토글이 전체적인 ui 에서 눈에 띔, `visualizationToggle`는 예시고 전체적으로 카드내의 항목이 복잡할때 과도한 윤곽선 표시 등등 전체적인 미니멀 추구 필요"
  severity: cosmetic
  test: 12
  root_cause: "Several nested controls still render as bordered segmented controls or bordered cards inside already-framed panels. `#visualizationToggle` uses `.tab-list` with background, border, padding, and active-button borders, while item rows, account rows, transfer cards, advanced blocks, and hover states add additional outlines. The phase removed ambient effects but did not complete a minimal nested-control visual pass."
  artifacts:
    - path: "apps/main/index.html"
      issue: "`#visualizationToggle` is a nested tab-list inside the Sankey panel header."
    - path: "apps/main/styles.css"
      issue: "`.tab-list`, `.tab-btn.is-active`, `.advanced-block`, `.account-row`, allocation rows, and transfer cards use multiple borders/backgrounds in dense card interiors."
    - path: "apps/main/styles.css"
      issue: "Global hover rules strengthen borders on cards and rows, increasing visual noise."
  missing:
    - "Run a minimal UI pass over nested controls and dense card interiors."
    - "Reduce segmented-control borders/backgrounds where hierarchy is already clear."
    - "Add visual regression or screenshot review for `visualizationToggle` and dense management panels."
  debug_session: "inline-uat-diagnosis-2026-06-16-rerun"
