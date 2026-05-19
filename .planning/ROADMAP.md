# Roadmap: v1.1 ~ v1.4 시뮬레이션 고도화 및 안정화

**Milestone:** v1.1~v1.3 (Completed), v1.4 (Active)
**Requirements covered:** 15/15 ✓ + New Focus

---

## Phase 3~5: 시뮬레이션 및 온보딩 고도화 (v0.8.1 완료)
- 시뮬레이션 차트 고도화 (v1.1)
- KPI 요약 카드 및 테이블 헤더 정리 (v1.1)
- Step 1 Spotlight 온보딩 가이드 (v1.1)

---

## Phase 6~9: 기능 확장 (v0.9.x 완료)
- Phase 6: 포트폴리오 자산 구성 및 리밸런싱
- Phase 8: 지출 데이터 과거 비교 분석
- Phase 9: 신혼부부 통합 허브 (부부 데이터 병합)
- Step 1 'Smart Add' (SMS 파싱)

---

## Phase 10: 백테스트 관련 기능 제거 및 이관 (v0.9.48 완료)

**Goal:** `IndividualSavingsFlowUI`의 백테스트 코드를 `stock-snowball` 프로젝트로 이관하여 코어 안정성에 집중.

---

## Phase 11: 코어 안정화 (v0.10.0 완료)

**Goal:** 시스템의 보안, 메모리, 데이터 정합성 결함을 해결하여 프로덕션 수준의 신뢰성 확보.

**Success Criteria:**
1. **보안**: XSS 방지 및 데이터 Sanitize 강제 (완료)
2. **메모리**: 중복 이벤트 리스너 제거 및 생명주기 관리 (완료)
3. **데이터**: 비교 엔진의 합산 로직 및 정합성 보정 (완료)
4. **버전 관리**: PWA 자산 및 서비스 워커 동기화 (완료)

---

## Phase 12: 종합 고도화 (Advanced Refinement - Active)

**Goal:** Step 1~3 전반의 UX를 고도화하고 전역 디자인 일관성을 확보한다.

**Target Deliverables:**
1. **전역 스타일 통합**: `shared/styles/step-theme.css` 기반 디자인 시스템 구축.
2. **성능 최적화**: Sankey 및 시뮬레이션 렌더링 부하 감소.
3. **PWA 안정화**: 오프라인 상태에서의 데이터 동기화 예외 처리 강화.
4. **다국어 기초 설계**: 텍스트 리소스 외부화.

---

*Roadmap updated: 2026-05-19 (Reflecting v1.4 Milestone Audit)*

