# Roadmap: v1.1 시뮬레이션 고도화 및 온보딩 UX

**Milestone:** v1.1
**Phases:** 3 (Phase 3–5, continuing from v1.0)
**Requirements covered:** 8/8 ✓

---

## Phase 3: 시뮬레이션 차트 시각화 고도화

**Goal:** 현재 추세선만 표시하는 배당 시뮬레이션 차트를 정보 밀도가 높은 인터랙티브 차트로 전면 개선한다.

**Requirements:** SIM-01, SIM-02, SIM-03, SIM-04

**Success Criteria:**
1. 각 연도에 원형 데이터 포인트가 표시되며, PR/TR 선 위에 명확히 위치한다
2. 데이터 포인트 호버/탭 시 해당 연도의 자산, 배당금 등 세부 수치가 툴팁으로 나타난다
3. Y축에 금액 눈금 라벨이 표시되고, 수평 그리드 라인이 차트 가독성을 높인다
4. PR과 TR 사이 영역이 반투명 색상으로 채워져 복리 효과 차이가 시각적으로 드러난다
5. 모바일(768px 이하) 레이아웃에서 차트가 정상적으로 축소/표시된다

---

## Phase 4: KPI 대시보드 카드 및 테이블 정리

**Goal:** 시뮬레이션 결과의 핵심 수치를 KPI 카드로 요약 제공하고, 기존 테이블 헤더의 시각적 잡음을 제거한다.

**Requirements:** SIM-05, TBL-01

**Success Criteria:**
1. 시뮬레이션 대시보드 상단에 최종 자산, 최종 연 배당금, 누적 수익률 등 KPI 카드가 표시된다
2. KPI 카드가 시뮬레이션 파라미터 변경 시 실시간으로 갱신된다
3. KPI 카드가 DESIGN.md의 Glassmorphism 패널 스타일을 따른다
4. Step 2 테이블 헤더에서 (만원) 표기가 제거되어 간결해진다
5. 모바일에서 KPI 카드가 가로 스크롤 또는 스택 레이아웃으로 정상 표시된다

---

## Phase 5: Step 1 Spotlight 온보딩 가이드

**Goal:** Step 1에 처음 접속하는 사용자에게 프리셋 선택 흐름을 단계별로 안내하는 Spotlight 가이드를 제공한다.

**Requirements:** ONB-01, ONB-02

**Success Criteria:**
1. Step 1 첫 접속 시 프리셋 선택 영역을 강조하는 Spotlight 오버레이가 자동으로 나타난다
2. 가이드가 프리셋 선택 → 시각화 확인 순서를 안내하는 단계별 흐름을 제공한다
3. 사용자가 가이드를 닫으면 localStorage에 상태가 저장되어 재접속 시 표시되지 않는다
4. Spotlight 오버레이가 DESIGN.md의 Glassmorphism 스타일과 ISF 색상 팔레트를 따른다
5. 모바일에서 Spotlight 위치와 텍스트가 뷰포트 내에 정상 표시된다

---

*Roadmap created: 2026-05-03*
