<!-- generated-by: gsd-doc-writer -->
# Roadmap: v1.1 ~ v1.2 시뮬레이션 고도화 및 자산 관리 확장

**Milestone:** v1.1 (Phase 3~5), v1.2 (Phase 6~9)
**Requirements covered:** 13/14 + New Features from Issues

---

## Phase 3: 시뮬레이션 차트 시각화 고도화 (v0.7.15 완료)
## Phase 4: KPI 대시보드 카드 및 테이블 정리 (v0.7.15 완료)
## Phase 5: Step 1 Spotlight 온보딩 가이드 (v0.8.1 완료)

---

## Phase 6: 포트폴리오 자산 구성 및 리밸런싱 (Step 3 - v0.9.5 완료)

**Goal:** Step 1의 투자 여력 데이터를 기반으로 실제 계좌/종목 비중을 구성하고, 목표 비중과의 격차를 분석하여 리밸런싱 가이드를 제공한다.

---

## Phase 7: 백테스트 시뮬레이터 대시보드 (Step 4 - v0.9.42 완료)

**Goal:** 주요 지수 및 자산의 과거 시계열 데이터를 기반으로 거치식/적립식 수익률을 시뮬레이션하고, 비교 분석 기능을 제공한다.

**Success Criteria:**
1. **정적 데이터 엔진**: 나스닥, S&P 500 등 주요 지수의 JSON 데이터 로딩 및 파싱. ✓
2. **복리 계산 엔진**: CAGR, IRR, MDD 등 금융 지표 계산 로직 구현 (TS - TDD 기반). ✓
3. **인터랙티브 대시보드**: React 19 기반의 반응형 UI 및 SVG 맞춤형 시계열 차트. ✓
4. **상대 비교 모드**: 특정 자산을 0%로 둔 상대 수익률 시각화 기능. ✓
5. **레버리지 & 청산 로직**: 레버리지 자산의 변동성 드래그 및 원금 청산(99% 손실) 반영. ✓ (v0.9.7)
6. **실감형 금융**: 수동 환율 설정 및 배당금 원화 환산 표기 추가. ✓ (v0.9.42)

**Current Status Note:**
- [v0.9.42] 환율 직접 입력 기능 및 연 배당금 KRW 표시 기능 추가로 최종 폴리싱 완료.

**Plans:** 3 plans
- [x] 07-01-PLAN.md — 데이터 구조 확립 및 시뮬레이션 엔진 구현 (v0.9.6)
- [x] 07-02-PLAN.md — React 기반 대시보드 레이아웃 및 차트 컴포넌트 개발 (v0.9.6)
- [x] 07-03-PLAN.md — 사용성 개선 및 버그 수정 (v0.9.42)

---

## Phase 8: 지출 데이터 과거 비교 분석 (Issue #4 - v0.9.43 완료)

**Goal:** `DataHub`에 저장된 이전 스냅샷 데이터를 불러와 현재 지출과 카테고리별로 비교하는 시각화 도구를 제공한다.

**Success Criteria:**
1. **스냅샷 API 강화**: IndexedDB에서 과거 스냅샷을 조회하고 로드하는 기능 고도화. ✓
2. **비교 연산 엔진**: 이전/현재 데이터 간의 차액(Delta) 및 변화율 계산 로직 구현. ✓
3. **시각적 분석**: SVG 기반 Grouped Bar Chart를 통해 지출 변화를 직관적으로 비교. ✓ (v0.9.43)
4. **실시간 연동**: 현재 입력값 변경 시 비교 차트 및 요약 카드가 즉시 업데이트. ✓ (v0.9.43)

**Current Status Note:**
- [v0.9.43] Step 1에 과거 지출 비교 패널 활성화 및 시각화 엔진 통합 완료.

**Plans:**
- [x] 08-01-PLAN.md — 스냅샷 비교 엔진 및 막대 그래프 시각화 구현 (v0.9.14)

---

## Phase 9: 신혼부부 통합 허브 (Newlywed Harmony Hub - Issue #2, 미시작)

**Goal:** 부부 간의 현금 흐름을 통합하고, 지출 예산 관리 및 입력 편의성을 극대화한다.

**Key Features (Planned):**
- **Smart Clipboard Parser**: 은행/카드 사용 내역 문자 자동 파싱 엔진.
- **Dual-Flow Merge**: 부부 간 데이터 해시 병합 및 통합 Sankey 다이어그램.

**Plans:**
- [ ] 09-01-PLAN.md — 요구사항 정의 및 파싱 엔진 설계 (예정)

---

*Roadmap updated: 2026-05-10 (Reverting Phase 07/08 status and adding polish notes)*
 통합됨.

**Plans:**
- [x] 09-01-PLAN.md — 요구사항 정의 및 파싱 엔진 설계 (v0.9.44)

---

*Roadmap updated: 2026-05-10 (Reverting Phase 07/08 status and adding polish notes)*
