# Roadmap: v1.1 ~ v1.2 시뮬레이션 고도화 및 자산 관리 확장

**Milestone:** v1.1 (Phase 3~6), v1.2 (Phase 7~8)
**Requirements covered:** 8/8 ✓ + New Features from Issues

---

## Phase 3: 시뮬레이션 차트 시각화 고도화 (v0.7.15 완료)
## Phase 4: KPI 대시보드 카드 및 테이블 정리 (v0.7.15 완료)
## Phase 5: Step 1 Spotlight 온보딩 가이드 (v0.8.1 완료)

---

## Phase 6: 포트폴리오 자산 구성 및 리밸런싱 (Step 3)

**Goal:** Step 1의 투자 여력 데이터를 기반으로 실제 계좌/종목 비중을 구성하고, 목표 비중과의 격차를 분석하여 리밸런싱 가이드를 제공한다.

**Success Criteria:**
1. 투자 자산(Cash/Savings/Invest)의 계좌별 상세 비중을 설정할 수 있는 에디터 구현
2. 목표 비중(Target) vs 실제 보유(Actual) 격차를 시각화하는 도넛/레이더 차트 제공
3. 부족한 비중을 채우기 위한 매수 필요 금액 계산 및 리밸런싱 시나리오 가이드 생성
4. Sankey 다이어그램 하단에 계좌별 자금 흐름 연결 (Step 1 -> Step 3 Bridge)

---

## Phase 7: 지출 데이터 과거 비교 분석 (Issue #4)

**Goal:** `DataHub`에 저장된 이전 스냅샷 데이터를 불러와 현재 지출과 카테고리별로 비교하는 시각화 도구를 제공한다.

**Success Criteria:**
1. [이전] vs [현재] 데이터를 나란히 배치한 그룹형 막대 그래프(Grouped Bar Chart) 구현
2. 카테고리별 지출 증감액(Diff) 및 증감률을 명확히 표시
3. 과거 데이터 부재 시 샘플 데이터를 통한 안내 또는 대체 UI 노출
4. Sankey 다이어그램 패널 내 '비교 보기' 탭 전환 기능 추가

---

## Phase 8: 신혼부부 통합 허브 (Newlywed Harmony Hub - Issue #2)

**Goal:** 부부 간의 현금 흐름을 통합하고, 지출 예산 관리 및 입력 편의성을 극대화한다.

**Success Criteria:**
1. **스마트 클립보드 파서**: 은행/카드 승인 문자를 복사-붙여넣기하여 지출 항목 자동 생성
2. **변동 지출 예산 관리**: 항목별 목표 예산 설정 및 실지출 게이지(Progress Bar) 표시
3. **부부 데이터 병합**: 두 사용자의 데이터 해시를 병합하여 통합 Sankey 다이어그램 렌더링
4. **모임통장 자동 합산**: 공용 노드를 중심으로 가구 전체의 자금 흐름 시각화

---

*Roadmap updated: 2026-05-06 (Reflecting GitHub Issues #2, #4)*
