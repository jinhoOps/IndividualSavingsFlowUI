# Requirements: IndividualSavings Flow UIUX

**Defined:** 2026-05-03
**Core Value:** 단순한 프리셋 선택만으로 즉각적인 자산 시각화 결과를 제공하고, 복잡한 재무 계산의 부담 없이 직관적인 개인 예산 흐름을 파악하게 한다.

## v1.1 ~ v1.3 Requirements (Completed)

- [x] **SIM-01~05**: 시뮬레이션 차트 고도화 및 KPI 요약 카드
- [x] **TBL-01**: Step 2 테이블 헤더 간소화
- [x] **ONB-01~02**: Step 1 Spotlight 온보딩 가이드
- [x] **PORT-01**: 포트폴리오 자산 구성 및 시각화 (Step 3)
- [x] **VIZ-01**: 과거 지출 스냅샷 비교 분석
- [x] **SYNC-01**: 부부 데이터 병합 및 ISF CODE 연동

## v1.4 Requirements (Current: Stability & Advanced)

### 코어 안정화 (STAB)
- [x] **STAB-01**: 보안(XSS) 강화 및 데이터 Sanitize 강제
- [x] **STAB-02**: 메모리 누수 방지 (Event Listener 생명주기 관리)
- [x] **STAB-03**: PWA 자산 및 서비스 워커 동기화 무결성 확보
- [ ] **STAB-04**: 전역 스타일 가이드 정립 및 Step 간 UI 일관성 확보 (진행 중)
- [ ] **STAB-05**: 비정상 데이터 입력 방지 및 예외 처리 로직 강화

### 종합 고도화 (ADV)
- [ ] **ADV-01**: Sankey 및 시뮬레이션 엔진 렌더링 최적화
- [ ] **ADV-02**: 모바일 가로모드 최적화 및 UX 디테일 개선
- [ ] **ADV-03**: 다국어 지원을 위한 텍스트 리소스 외부화 기초 설계

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SIM, TBL, ONB | 3~5 | ✅ Completed |
| PORT, VIZ, SYNC | 6~9 | ✅ Completed |
| STAB-01~03 | 11 | ✅ Completed |
| STAB-04~05 | 11, 12 | 🟡 In Progress |
| ADV-01~03 | 12 | 🟡 In Progress |

---
*Last updated: 2026-05-19 for v1.4 Milestone Audit*

