---
status: pending
phase: 05-portfolio-creation-allocation-ui
source:
  - 05-01-PLAN.md
started: 2026-06-15T14:00:00+09:00
updated: 2026-06-15T14:00:00+09:00
---

## Current Test

[awaiting implementation]

## Tests

### 1. Cold Start Smoke Test
expected: |
  프로젝트의 빌드가 오류 없이 통과해야 합니다.
  npm run build 실행 시 에러 없이 배포용 번들이 빌드되는지 확인합니다.
result: pending

### 2. 포트폴리오 이름 및 종목 추가/삭제 (Portfolio Creator Form)
expected: |
  나만의 포트폴리오 만들기 화면에서 포트폴리오 이름을 지정하고, 종목 추가 버튼을 통해 종목명과 티커를 입력하는 필드가 동적으로 추가 및 삭제되는지 확인합니다.
result: pending

### 3. 주기 선택 세그먼트 컨트롤 (Period Segment Control)
expected: |
  매일, 매주, 매달 적립 주기를 가로형 세그먼트 스위치 버튼을 통해 자연스럽게 선택할 수 있고, 선택된 주기가 시각적으로 활성화 상태를 띄는지 확인합니다.
result: pending

### 4. 실시간 금액 자동 합산 및 비중 % 산출 (Real-time Sum & Ratio Calculation)
expected: |
  개별 종목의 매수 금액(원)을 입력함에 따라 상단에 실시간으로 총 주식 개수 및 총 매수 금액 합계가 오차 없이 자동 합산되는지 확인합니다.
  각 종목의 입력 금액 비중 %가 실시간 계산되어 정수(반올림) 단위로 화면에 정확히 표시되는지 확인합니다.
result: pending

### 5. 실시간 한글 금액 힌트 상시 표출 (Korean Won Translation Hint)
expected: |
  개별 종목 금액 입력창 하단과 요약 영역의 총 매수 금액 옆에 IsfUtils.convertToKoreanWon를 활용한 실시간 한글 금액 힌트(예: "1억 2,500만원")가 상시 노출되는지 확인합니다.
result: pending

### 6. 입력값 유효성 검증 및 확인 버튼 제어 (Amount Validation & Save Activation)
expected: |
  개별 종목의 매수 금액이 1,000원 미만이거나 1,000원 단위가 아닐 때(예: 1,500원 입력 시) 에러 또는 경고 상태가 표시되는지 확인합니다.
  종목 개수가 2개 이상이고 모든 종목의 금액이 1,000원 단위 제약을 완벽히 충족할 때만 '확인(저장)' 버튼이 비활성화에서 활성화 상태로 전환되는지 확인합니다.
result: pending

### 7. 에디토리얼 요약 카드 목록 및 호버 효과 (Editorial Card List & Hover Effect)
expected: |
  생성 완료된 포트폴리오가 리스트 영역에 에디토리얼 포트폴리오 요약 카드로 렌더링되는지 확인합니다.
  카드에 포트폴리오 이름, 설정 주기, 총 매수 금액, 구성된 종목 개수 요약 정보가 올바르게 바인딩되는지 확인합니다.
  카드 호버 시 Sunset Orange 테두리 광채 효과 및 Y축 -2px 부유 애니메이션이 부드럽게 적용되는지 확인합니다.
result: pending

### 8. 카드 상세 보기 팝업 연동 (Detail Modal Popup)
expected: |
  리스팅된 포트폴리오 카드를 클릭했을 때, 해당 포트폴리오 구성 종목의 상세 금액/비중 및 누적 투자액 추이를 보여주는 세부 내역 팝업/모달이 Glassmorphism 블러 효과(backdrop-filter: blur(10px))와 함께 정상 연동되어 상세 내용을 시각적으로 확인할 수 있는지 검증합니다.
result: pending

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps

- 없음 (UAT 최초 설계)
