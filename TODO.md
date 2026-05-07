---
kanban-plugin: basic
---

# TODO (v0.9.8)

## Done (v0.9.8)
- [x] **Phase 8: 지출 데이터 과거 비교 분석 (Issue #4 - v0.9.8)**:
    - [x] **데이터 브릿지 확장**: `SnapshotManager`를 통한 과거 스냅샷 데이터 로드 API 강화.
    - [x] **Grouped Bar Chart**: 카테고리별 [이전] vs [현재] 지출 비교 막대 그래프 구현.
    - [x] **시스템 통합**: `app.js`와 연동하여 실시간 비교 UI 구축.
- [x] **Phase 7: 주요 지수 및 자산 백테스트 시뮬레이터 (Issue #7 - v0.9.7)**:
    - [x] TDD 기반 금융 연산 엔진 (CAGR, IRR, MDD, TR) 구현.
    - [x] React 19 + Tailwind v4 기반 대시보드 및 커스텀 SVG 차트 구축.
    - [x] 나스닥, S&P 500, 금, 기준금리 시계열 데이터 통합.
    - [x] **레버리지 자산 및 청산 엔진 도입**: QLD(2x), TQQQ(3x) 레버리지 수익률 합성 및 청산 UI.
- [x] **Phase 6: 포트폴리오 리밸런싱 가이드 (Step 3 - v0.9.5)**:
    - [x] 계좌/종목별 비중 설정 UI 및 비중 연산 로직 구현.
    - [x] 목표 vs 실제 분석 도넛 차트 및 리밸런싱 액션 가이드.
    - [x] 포트폴리오 스냅샷 저장 및 복원.
- [x] **전역 버전 동기화 (v0.9.8)**: sw.js, manifest, package.json, IsfUtils.APP_VERSION 동기화.

## Phase 9: 신혼부부 통합 허브 (Issue #2)
- [ ] **Smart Clipboard Parser**: 은행/카드 문자 자동 파싱 엔진 개발.
- [ ] **Dual-Flow Merge**: 부부 간 데이터 해시 병합 및 통합 Sankey 다이어그램 렌더링.
- [ ] **Shared Viewport**: 모바일에서 부부 공통 예산을 관리할 수 있는 전용 UI 모드.

## Next High Priority
- [ ] **시뮬레이션 차트 고도화**: 데이터 포인트, 호버 툴팁, Y축 눈금/그리드 개선.
- [ ] **KPI 요약 카드**: 최종 자산, 최종 연 배당금, 누적 수익률 등 핵심 지표 시각화.
- [ ] **Step 1 Spotlight UX**: 첫 접속 사용자 온보딩 가이드.

# RECENT HISTORY (v0.8.7~v0.8.8)
- [x] **v0.8.8**: Step 1 초기 자산 필드 구조 개선(현금/저축/투자 분리) 및 SimChart 시각적 버그 수정.
- [x] **v0.8.7**: '억' 단위 변환 버그 수정 및 CompatibilityBridge 정합성 확보.

# ARCHIVE
- 상세 내역은 `[[Project_History]]` 및 `[[log.md]]` 참조.
- v0.8.1 이전(Phase 5, v0.7.x, v0.6.x, v0.5.x) 기록 정리 완료.

%% kanban:settings
```
{"kanban-plugin":"basic"}
```
%%
