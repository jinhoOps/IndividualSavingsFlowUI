---
kanban-plugin: basic
---

# TODO (v0.8.9)

## Done (v0.8.9)
- [x] **Step 2 초기 투자 자산(totalInitialAsset) 연동**: Step 1의 `startInvest` 데이터를 시뮬레이션 원금으로 반영.
- [x] **Step 2 동기화 로직 고도화**: 데이터 정합성 체크 강화 및 "Step 1로 이동" 가이드 제공.
- [x] **UI/UX 레이블 일관성 확보**: 과세 경고 배지 문구를 '과세주의/과세경고'로 전역 통일.
- [x] **GitHub 이슈 로드맵 통합**: 이슈 #2, #4 내용을 Phase 7, 8로 정의하여 로드맵 확장.
- [x] **전역 버전 동기화 (v0.8.9)**: sw.js, manifest, package.json, IsfUtils.APP_VERSION 동기화.

# FUTURE (Phase 6~8)

## Phase 6: 포트폴리오 자산 구성 및 리밸런싱 (Step 3)
- [ ] **Step 3 아키텍처 설계**: Step 1 투자 데이터를 수신하는 전용 모듈(`step1-receiver.js`) 정의
- [ ] **계좌별 자산 에디터**: 연금저축, ISA, 일반계좌 등 계좌별 비중 설정 기능
- [ ] **목표 vs 실제 분석**: 도넛 차트를 활용한 비중 격차 시각화 및 리밸런싱 액션 가이드
- [ ] **포트폴리오 스냅샷**: 현재 구성 상태를 히스토리로 저장 및 복원

## Phase 7: 지출 데이터 과거 비교 분석 (Issue #4)
- [ ] **데이터 브릿지 확장**: `SnapshotManager`를 통한 과거 스냅샷 데이터 로드 API 강화
- [ ] **Grouped Bar Chart**: 카테고리별 [이전] vs [현재] 지출 비교 막대 그래프 구현

## Phase 8: 신혼부부 통합 허브 (Issue #2)
- [ ] **Smart Clipboard Parser**: 은행/카드 문자 자동 파싱 엔진 개발
- [ ] **Dual-Flow Merge**: 부부 간 데이터 해시 병합 및 통합 Sankey 다이어그램 렌더링

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
