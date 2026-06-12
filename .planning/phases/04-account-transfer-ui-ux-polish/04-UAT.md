---
status: complete
phase: 04-account-transfer-ui-ux-polish
source:
  - 04-01-SUMMARY.md
started: 2026-06-12T15:50:00+09:00
updated: 2026-06-12T16:20:00+09:00
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: |
  프로젝트의 빌드가 오류 없이 통과해야 합니다.
  npm run build 실행 시 에러 없이 배포용 번들이 빌드되는지 확인합니다.
result: pass

### 2. 시각화 패널 토글 (Visual Slide Transition)
expected: |
  `Sankey 흐름` ↔ `계좌 이체망` 탭을 클릭하여 좌우로 차트가 부드러운 슬라이딩 모션 클래스(.visual-slide-container)와 함께 스와이프되어 전환되는지 확인합니다.
result: pass

### 3. 수동 이체 설정 (Manual Transfer Rules & UI)
expected: |
  계좌 관리 탭 하단에서 수동 이체를 추가/삭제해봅니다.
  출발 계좌를 선택할 때 하단 힌트 텍스트(`💡 출금 가능 예상 잔액`)가 실시간 변경되는지 확인합니다.
  등록된 이체 카드에 마우스 호버 시에만 `X` 삭제 버튼이 페이드인으로 노출되는지 확인합니다.
result: pass

### 4. 계좌 간 자금 흐름 지도 (Account Flow Network Map)
expected: |
  추가된 수동 이체 규칙이 `계좌 이체망` SVG 차트에 노드-링크 배치로 반영되는지 확인합니다.
  각 노드를 잇는 라인에 자금 흐름의 방향성을 보여주는 펄스 애니메이션(stroke-dashoffset)이 작동하는지 확인합니다.
  특정 계좌 노드를 호버했을 때 연결된 이체선만 선명해지고(Opacity 1.0) 무관한 다른 연결선들은 투명해지는지(Opacity 0.15) 확인합니다.
result: pass

### 5. 도움말 ? 아이콘 툴팁 통합 (Glassmorphism Tooltip)
expected: |
  화면 곳곳에 배치된 물음표 `?` 아이콘에 마우스를 호버했을 때, 반투명하고 깔끔한 Glassmorphism 디자인의 부유형 툴팁(#globalTooltip)이 마우스 위치에 자연스럽게 팝업되는지 확인합니다.
result: pass

### 6. 금융소득과세 경고 인디케이터 (Real-time Safety Margin Indicator)
expected: |
  저축 탭의 이율이나 투자 금액을 1,900만 원 혹은 3,400만 원 금융소득 초과선으로 변경 시, 계좌 카드의 보더 링과 뱃지가 즉각 경고(Yellow) / 위험(Red) 상태로 전환되고 글로우 효과가 부드럽게(cubic-bezier) 적용되는지 확인합니다.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- 없음 (피드백 반영 및 버그 수정 완료)
  - 1. 모바일 `summary-cards`를 2x3 2열 그리드로 정비하고 모바일 화면에서 `.sub` 보조설명 텍스트를 숨김 처리하여 깔끔하게 적용 완료.
  - 2. HTML에서 누락되었던 수동 이체 에디터(`transferEditorSection`)를 `mgmtPanelAccount` 탭 내부 하단에 완벽히 탑재하여 버그 해결.
  - 3. 계좌이체망의 배치를 Circular(원형)에서 LR(좌우 지그재그) 방식으로 레이아웃 고도화하고, 각 노드 내부에 계좌명 외에 금액(만원)도 함께 2줄로 표기 완료.
  - 4. 하단 legend-group 에서 월별 금액 외에 연 환산 금액(연 X만)을 함께 포맷팅하여 노출 완료.
  - 5. 미적용 가이드 텍스트 및 상세 요약 계산 공식 details 블록을 완전히 숨기거나 제거하고 `?` 물음표 툴팁 trigger 내부로 세련되게 통합 완료.
  - 6. "수익률/기타" 블록(`ratesAdvancedBlock`)이 엉뚱한 탭 영역에 들어가 있어 보이지 않던 꼬임 버그를 올바른 부모인 `advancedSettings` 탭 영역으로 이사하여 미표기 버그 완치.
  - 7. 금융소득과세 뱃지 텍스트를 지우고 오직 보더 링 색상으로만 구분하며, 화면 상단에 LED 형태로 빛나고 깜빡거리는 글로벌 경고등(`globalFinancialIncomeIndicator`)을 구현하여 시인성을 극대화 완료.
