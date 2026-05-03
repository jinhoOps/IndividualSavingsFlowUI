---
status: testing
phase: 03-chart-visualization
source: [01-SUMMARY.md]
started: 2026-05-03T14:48:00+09:00
updated: 2026-05-03T14:48:00+09:00
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running server/service. Clear ephemeral state (temp DBs, caches, lock files). Start the application from scratch. Server boots without errors, any seed/migration completes, and a primary query (health check, homepage load, or basic API call) returns live data.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Clear ephemeral state (temp DBs, caches, lock files). Start the application from scratch. Server boots without errors, any seed/migration completes, and a primary query (health check, homepage load, or basic API call) returns live data.
result: pending

### 2. 차트 반응형 및 Y축 그리드
expected: 브라우저 창 크기를 조절할 때 시뮬레이션 차트가 잘리지 않고 비율에 맞게(유연하게) 조절되어야 합니다. 차트 좌측/내부에 만원 단위 자산 스케일이 표시된 수평 Y축 그리드선이 나타나야 합니다.
result: pending

### 3. 복리 영역 시각화 (Polygon)
expected: 차트의 PR(미투자, 회색 점선) 선과 TR(재투자, 주황색 실선) 선 사이의 영역이 반투명한 주황색으로 채워져, 재투자에 따른 복리 효과 차이가 시각적으로 명확하게 보여야 합니다.
result: pending

### 4. 데이터 포인트 및 툴팁
expected: 차트 각 연도별로 점이 표시되어야 하며, 차트 영역 위로 마우스를 올리거나 터치하면 해당 위치에 맞는 연도별 상세 데이터(연도, 총 자산, 연 배당금)가 만원 단위로 툴팁에 표시되어야 합니다.
result: pending

### 5. 프리셋 버튼 동작
expected: 시뮬레이션 설정 영역의 프리셋 버튼("단일 100%", "SCHD+QQQI (1:1)", "3종 혼합") 중 하나를 클릭하면, 연관된 기대 배당수익률, 배당 성장률, 주가 상승률 입력값이 즉시 변경되고 활성화 상태가 표시되며 차트가 새 데이터로 즉시 다시 그려져야 합니다.
result: pending

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0

## Gaps
