# Project Roadmap

## Milestone v1.0: 템플릿 기반 자산 흐름 시각화

### Phase 1: 프리셋 템플릿 로드 및 자동 시각화
**Status:** Completed
**Goal:** 사용자가 연봉과 투자 스타일을 선택하면 표준 템플릿이 로드되어 시각화 화면에 즉시 반영된다.
**Requirements:** PRESET-01, PRESET-02
**Success Criteria:**
- 연봉 및 투자 성향 선택 UI가 노출되고 작동한다.
- 프리셋 선택 시 내부 데이터 모델에 표준 자산 분배율이 자동 적용된다.
- 변경된 데이터가 시각화 엔진(Sankey Diagram 등)에 즉시 렌더링된다.

### Phase 2: 템플릿 세부 항목 수동 조절 기능
**Status:** In Progress
**Goal:** 프리셋으로 생성된 자산 흐름 템플릿의 세부 항목들을 사용자가 직접 편집하고 재계산 결과를 확인할 수 있다.
**Requirements:** PRESET-03
**Plans:** 1 plans
- [x] 02-01-PLAN.md — 프리셋 로드 후 세부 항목 수동 조정 UI 및 영속성 구현
**Success Criteria:**
- 템플릿 적용 후 각 카테고리별 세부 항목(생활비, 저축 등)을 조절할 수 있는 UI가 제공된다.
- 항목 값 변경 시 전체 예산 흐름이 자동으로 재계산된다.
- 조절된 값이 시각화 및 IndexedDB 스토리지에 올바르게 저장/반영된다.
