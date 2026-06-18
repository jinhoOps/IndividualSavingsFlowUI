---
status: testing
phase: 08-step-2-redesign-re-planning
source: [08-01-SUMMARY.md, 08-02-SUMMARY.md, 08-03-SUMMARY.md, 08-04-SUMMARY.md]
started: 2026-06-18T16:31:12+09:00
updated: 2026-06-18T16:54:00+09:00
---

## Current Test

number: 2
name: 전략 선택과 보수적 가정 표시
expected: |
  Step 2에서 지수 성장, SCHD 배당 성장, 커버드콜/월배당 전략 카드가 보이고, Nasdaq/S&P 500 벤치마크 및 JEPI/QQQI/DIVO 예시를 선택할 수 있다. 고급 가정은 기본적으로 접혀 있으며 펼치면 수익률/배당/성장률 범위가 이해 가능한 문구로 보인다.
awaiting: user response

## Tests

### 1. Step 1 원본값 가져오기와 초기화 경계
expected: Step 1에서 입력한 투자 가능 금액이 Step 2 진입 시 원본값으로 반영된다. Step 2에서 금액을 수정해도 Step 1 원본값은 바뀌지 않고, Step 2 초기화를 누르면 Step 1 원본값 기준으로 되돌아온다.
result: pass

### 2. 전략 선택과 보수적 가정 표시
expected: Step 2에서 지수 성장, SCHD 배당 성장, 커버드콜/월배당 전략 카드가 보이고, Nasdaq/S&P 500 벤치마크 및 JEPI/QQQI/DIVO 예시를 선택할 수 있다. 고급 가정은 기본적으로 접혀 있으며 펼치면 수익률/배당/성장률 범위가 이해 가능한 문구로 보인다.
result: [pending]

### 3. KPI, 그래프, 비교 카드 결과
expected: 초기 투자금, 월 투자금, 투자 기간을 바꾸면 최종 예상 자산, 세후 월 현금흐름, 벤치마크 대비 차이가 화면의 KPI, 그래프, 비교 카드에 함께 갱신된다. 벤치마크 대비 불리한 전략은 음수 차이가 숨겨지지 않고 기회비용처럼 보인다.
result: [pending]

### 4. 5천만 원 이하 초기자본 경고
expected: 총 초기 투자금이 5천만 원 이하이면 Step 2 화면에 초기자본 부족 경고가 보이고, 5천만 원을 초과하면 해당 경고가 사라진다. 이전 1억 원 기준 경고 문구는 보이지 않는다.
result: [pending]

### 5. 모바일 첫 화면 읽기 흐름
expected: 390px와 768px 폭에서 Step 2 화면 순서가 판단 문장, 핵심 입력, KPI, 그래프, 비교 카드, 안내, 접힌 상세 표 순서로 자연스럽게 읽힌다. 텍스트 겹침, 잘림, 가로 넘침, 큰 레이아웃 점프가 없다.
result: [pending]

### 6. Step 2 저장, 목록, 불러오기, 삭제
expected: Step 2의 저장 버튼으로 현재 시뮬레이션을 저장할 수 있고, DataHub 시뮬레이션 목록에서 알아볼 수 있는 이름으로 보인다. 저장한 항목을 불러오면 Step 2 값과 전략 선택이 복원되고, 삭제하면 목록에서 사라진다.
result: [pending]

### 7. 정적 시장 데이터 출처와 루트 CSV 정리
expected: 프로젝트의 시장 데이터 설명은 public/data/indices/README.md에서 qqq.json, spy.json, schd.json을 런타임 근거 파일로 안내한다. 루트의 qqq_raw.csv, qqq_daily_raw.csv, qqq_daily_stooq.csv 파일은 남아 있지 않다.
result: [pending]

## Summary

total: 7
passed: 1
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
